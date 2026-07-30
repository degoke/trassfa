import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { customerProfileTable, type CustomerProfileRow } from "../db/schema.js";
import type {
  AuthenticatedUserProfile,
  BankToCryptoTransaction,
  CryptoToBankTransaction,
  CustomerLevel,
  QuotePreview,
  SkyewalletWebhookEvent,
  TransactionReference,
} from "../lib/domain.js";
import { formatAmount, toNumber } from "../lib/money.js";
import { createId } from "../lib/ids.js";
import { normalizePhone } from "../lib/phone.js";
import { SkyewalletClient } from "../lib/skyewallet.js";
import { extractReferenceValues, getWebhookDataValue } from "../lib/skyewallet-webhooks.js";
import { TransactionRepository } from "../repositories/transaction-repository.js";
import type {
  BankToCryptoTransactionInput,
  CryptoToBankTransactionInput,
} from "../routes/schemas.js";
import { currencyLevelLimits } from "../config/limits.js";
import { maskSensitiveIdentifier } from "../lib/encryption.js";
import { BankService } from "./bank-service.js";
import { buildBankToCryptoQuote, buildCryptoToBankQuote, QuoteService } from "./quote-service.js";

export class TransactionService {
  constructor(
    private readonly transactions: TransactionRepository,
    private readonly skyewallet: SkyewalletClient,
    private readonly quotes: QuoteService,
    private readonly banks: BankService,
  ) {}

  listTransactions(ownerUserId: string) {
    return this.transactions.listByOwner(ownerUserId);
  }

  getTransaction(id: string, ownerUserId: string) {
    return this.transactions.findByIdForOwner(id, ownerUserId);
  }

  async createCryptoToBankTransaction(
    owner: AuthenticatedUserProfile,
    input: CryptoToBankTransactionInput,
  ) {
    const id = createId("lp");
    const payinReference = buildPayReference(id, "payin");
    const profile = await this.ensureProfile(owner);
    const quote = await this.quotes.quoteCryptoToBank(input.deposit);
    await this.assertWithinLimits(
      owner.id,
      profile.level,
      input.deposit.fromCurrency,
      quote.fromAmount,
    );

    const resolvedBank = await this.banks.resolveBankAccount(input.bank);

    const customerId = await this.ensureSkyewalletCustomer(profile, id, "crypto_to_bank");

    let depositAccount: { id: string; address: string; expiresAt?: string };

    const payinRes = await this.skyewallet.createPayin({
      method: "crypto",
      customer_id: customerId,
      pay_reference: payinReference,
      type: "dynamic",
      currency: input.deposit.fromCurrency,
      network: input.deposit.network,
      amount: formatAmount(quote.fromAmount),
    });

    if (!payinRes.data.payin.account.address) {
      throw new Error("Skyewallet did not return a crypto address");
    }

    depositAccount = {
      id: payinRes.data.payin.account.id,
      address: payinRes.data.payin.account.address,
      expiresAt: payinRes.data.payin.account.expires_at ?? undefined,
    };

    const transaction: CryptoToBankTransaction = {
      id,
      ownerUserId: owner.id,
      direction: "crypto_to_bank",
      status: "awaiting_payment",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      customer: profileToCustomerProfile(profile),
      skyewalletCustomerId: customerId,
      deposit: {
        currency: input.deposit.fromCurrency,
        network: input.deposit.network,
        amount: quote.fromAmount,
        accountId: depositAccount.id,
        address: depositAccount.address,
        expiresAt: depositAccount.expiresAt,
      },
      bankDestination: {
        countryCode: resolvedBank.countryCode,
        bankCode: resolvedBank.bankCode,
        bankName: input.bank.bankName,
        accountNumber: resolvedBank.accountNumber,
        accountName: resolvedBank.accountName,
      },
      quote,
      references: [
        { type: "internal", value: id },
        { type: "customer", value: customerId },
        { type: "pay_reference", value: payinReference },
        { type: "payment_account", value: depositAccount.id },
        { type: "payment_address", value: depositAccount.address },
      ],
    };

    return this.transactions.create(transaction);
  }

  async createBankToCryptoTransaction(
    owner: AuthenticatedUserProfile,
    input: BankToCryptoTransactionInput,
  ) {
    const id = createId("lp");
    const payinReference = buildPayReference(id, "payin");
    const profile = await this.ensureProfile(owner);
    await this.assertWithinLimits(owner.id, profile.level, "NGN", input.fiat.amount);

    const validation = await this.skyewallet.validateAddress({
      address: input.wallet.address,
      currency: input.wallet.currency,
      network: input.wallet.network,
    });

    if (!validation.data.valid) {
      throw new Error(
        validation.error?.message ??
          `Invalid ${input.wallet.currency} address for ${input.wallet.network} network`,
      );
    }

    const quote = await this.quotes.quoteBankToCrypto({
      fromAmount: input.fiat.amount,
      toCurrency: input.wallet.currency,
      network: input.wallet.network,
    });

    const customerId = await this.ensureSkyewalletCustomer(profile, id, "bank_to_crypto");

    let virtualAccount: {
      accountId: string;
      bankName: string;
      accountNumber: string;
      accountName: string;
      address?: string;
      expiresAt?: string;
    };

    const payinRes = await this.skyewallet.createPayin({
      method: "bank_transfer",
      customer_id: customerId,
      pay_reference: payinReference,
      type: "dynamic",
      currency: "NGN",
      amount: formatAmount(input.fiat.amount),
    });

    const account = payinRes.data.payin.account;

    if (!account.account_number || !account.account_name || !account.bank_name) {
      throw new Error("Skyewallet did not return a virtual account");
    }

    virtualAccount = {
      accountId: account.id,
      bankName: account.bank_name,
      accountNumber: account.account_number,
      accountName: account.account_name,
      address: account.address ?? undefined,
      expiresAt: account.expires_at ?? undefined,
    };

    const transaction: BankToCryptoTransaction = {
      id,
      ownerUserId: owner.id,
      direction: "bank_to_crypto",
      status: "awaiting_payment",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      customer: profileToCustomerProfile(profile),
      skyewalletCustomerId: customerId,
      virtualAccount,
      payoutDestination: {
        address: input.wallet.address,
        currency: input.wallet.currency,
        network: input.wallet.network,
      },
      quote,
      references: [
        { type: "internal", value: id },
        { type: "customer", value: customerId },
        { type: "pay_reference", value: payinReference },
        { type: "payment_account", value: virtualAccount.accountId },
        { type: "virtual_account", value: virtualAccount.accountNumber },
        ...(virtualAccount.address
          ? [{ type: "payment_address" as const, value: virtualAccount.address }]
          : []),
      ],
    };

    return this.transactions.create(transaction);
  }

  private async ensureProfile(owner: AuthenticatedUserProfile): Promise<CustomerProfileRow> {
    const existing = await this.transactions.getCustomerProfile(owner.id);

    if (existing) {
      return existing;
    }

    const [firstName, ...rest] = owner.name.trim().split(/\s+/);
    const lastName = rest.join(" ").trim();

    const inserted = await db
      .insert(customerProfileTable)
      .values({
        userId: owner.id,
        firstName: firstName || "trassfa",
        lastName: lastName || "User",
        email: owner.email,
        phone: owner.phone,
      })
      .onConflictDoUpdate({
        target: customerProfileTable.userId,
        set: {
          firstName: firstName || "trassfa",
          lastName: lastName || "User",
          email: owner.email,
          phone: owner.phone,
          updatedAt: new Date(),
        },
      })
      .returning();

    const profile = inserted[0];
    if (!profile) {
      throw new Error("Failed to create customer profile");
    }

    return profile;
  }

  private async ensureSkyewalletCustomer(
    profile: CustomerProfileRow,
    transactionId: string,
    flow: string,
  ): Promise<string> {
    if (!profile.phone) {
      throw new Error(
        "Phone number is required to create a Skyewallet customer. Please add a phone number to your profile.",
      );
    }

    const customer = await this.skyewallet.getOrCreateCustomer({
      first_name: profile.firstName,
      last_name: profile.lastName,
      email: profile.email || "",
      phone: normalizePhone(profile.phone),
      metadata: {
        linkpay_transaction_id: transactionId,
        flow,
      },
    });

    if (profile.skyewalletCustomerId !== customer.id) {
      await db
        .update(customerProfileTable)
        .set({ skyewalletCustomerId: customer.id, updatedAt: new Date() })
        .where(eq(customerProfileTable.userId, profile.userId));
    }

    return customer.id;
  }

  async handleWebhookEvent(event: SkyewalletWebhookEvent) {
    switch (event.event) {
      case "payment.received":
        return this.handlePaymentReceived(event);
      case "account.expired":
        return this.handleAccountExpired(event);
      case "transfer.completed":
      case "payout.completed":
        return this.handleTransferCompleted(event);
      case "transfer.failed":
      case "payout.failed":
        return this.handleTransferFailed(event);
      case "swap.completed":
        return this.handleSwapCompleted(event);
      case "swap.failed":
        return this.handleSwapFailed(event);
      default:
        return {
          status: "ignored" as const,
        };
    }
  }

  private async handlePaymentReceived(event: SkyewalletWebhookEvent) {
    const match = await this.findMatchingTransaction(event);
    if (!match) {
      return { status: "ignored" as const };
    }

    const { transaction } = match;
    if (transaction.status !== "awaiting_payment" && transaction.status !== "failed") {
      await this.transactions.update(transaction.id, (current) => ({
        ...current,
        lastEvent: event,
      }));

      return {
        status: "processed" as const,
        matchedTransactionId: transaction.id,
      };
    }

    const isRetry = transaction.status === "failed";

    await this.transactions.update(transaction.id, (current) => ({
      ...current,
      status: "payment_received",
      error: undefined,
      references: isRetry
        ? current.references
        : appendReferences(current.references, [
            {
              type: "provider_transaction",
              value: valueOrEmpty(getWebhookDataValue(event, "transaction_id")),
            },
          ]),
      lastEvent: event,
    }));

    try {
      if (transaction.direction === "crypto_to_bank") {
        await this.startCryptoToBankSwap(transaction, event);
      } else {
        await this.startBankToCryptoSwap(transaction, event);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to process payment after receipt";

      await this.transactions.update(transaction.id, (current) => ({
        ...current,
        status: current.payout ? current.status : "failed",
        error: current.payout ? current.error : message,
        lastEvent: event,
      }));

      throw error;
    }

    return {
      status: "processed" as const,
      matchedTransactionId: transaction.id,
    };
  }

  private async handleAccountExpired(event: SkyewalletWebhookEvent) {
    const match = await this.findMatchingTransaction(event);
    if (!match) {
      return { status: "ignored" as const };
    }

    await this.transactions.update(match.transaction.id, (current) => {
      if (current.status !== "awaiting_payment") {
        return { ...current, lastEvent: event };
      }

      return {
        ...current,
        status: "expired",
        error: "Payment account expired before funds were received",
        lastEvent: event,
      };
    });

    return {
      status: "processed" as const,
      matchedTransactionId: match.transaction.id,
    };
  }

  private async handleTransferCompleted(event: SkyewalletWebhookEvent) {
    const match = await this.findMatchingTransaction(event);
    if (!match) {
      return { status: "ignored" as const };
    }

    await this.transactions.update(match.transaction.id, (current) => {
      if (current.status === "completed" || current.payout?.status === "completed") {
        return { ...current, lastEvent: event };
      }

      return {
        ...current,
        status: "completed",
        payout: current.payout
          ? {
              ...current.payout,
              status: "completed",
            }
          : current.payout,
        lastEvent: event,
      };
    });

    return {
      status: "processed" as const,
      matchedTransactionId: match.transaction.id,
    };
  }

  private async handleTransferFailed(event: SkyewalletWebhookEvent) {
    const match = await this.findMatchingTransaction(event);
    if (!match) {
      return { status: "ignored" as const };
    }

    await this.transactions.update(match.transaction.id, (current) => {
      if (current.status === "failed" || current.payout?.status === "failed") {
        return { ...current, lastEvent: event };
      }

      return {
        ...current,
        status: "failed",
        payout: current.payout
          ? {
              ...current.payout,
              status: "failed",
            }
          : current.payout,
        error:
          typeof event.data.reason === "string" ? event.data.reason : "Skyewallet transfer failed",
        lastEvent: event,
      };
    });

    return {
      status: "processed" as const,
      matchedTransactionId: match.transaction.id,
    };
  }

  private async handleSwapCompleted(event: SkyewalletWebhookEvent) {
    const match = await this.findMatchingTransaction(event);
    if (!match) {
      return { status: "ignored" as const };
    }

    await this.transactions.update(match.transaction.id, (current) => ({
      ...current,
      lastEvent: event,
    }));

    return {
      status: "processed" as const,
      matchedTransactionId: match.transaction.id,
    };
  }

  private async handleSwapFailed(event: SkyewalletWebhookEvent) {
    const match = await this.findMatchingTransaction(event);
    if (!match) {
      return { status: "ignored" as const };
    }

    await this.transactions.update(match.transaction.id, (current) => {
      if (
        current.status === "failed" ||
        current.status === "completed" ||
        current.status === "payout_pending"
      ) {
        return { ...current, lastEvent: event };
      }

      return {
        ...current,
        status: "failed",
        error: typeof event.data.reason === "string" ? event.data.reason : "Swap failed",
        lastEvent: event,
      };
    });

    return {
      status: "processed" as const,
      matchedTransactionId: match.transaction.id,
    };
  }

  private async startCryptoToBankSwap(
    transaction: CryptoToBankTransaction,
    event: SkyewalletWebhookEvent,
  ) {
    const payoutReference = buildPayReference(transaction.id, "payout");
    const receivedAmount =
      toNumber(getWebhookDataValue(event, "amount"), transaction.deposit.amount) ??
      transaction.deposit.amount;
    const quoteRes = await this.skyewallet.getSwapQuote({
      from_currency: transaction.deposit.currency,
      to_currency: "NGN",
      from_amount: formatAmount(receivedAmount),
    });
    const preview = buildCryptoToBankQuote(quoteRes.data, receivedAmount);
    const swapRes = await this.skyewallet.executeSwap(quoteRes.data.quote_id);
    const lockedQuote = lockQuote(
      this.quotes.reviseQuoteFromSwap(transaction.direction, preview, {
        fromAmount: toNumber(swapRes.data.from_amount, preview.fromAmount),
        toAmount: toNumber(swapRes.data.to_amount, preview.grossAmount),
      }),
    );
    const payout = await this.skyewallet.createPayout({
      type: "fiat",
      amount: formatAmount(lockedQuote.netAmount, 2),
      currency: "NGN",
      bank_code: transaction.bankDestination.bankCode,
      account_number: transaction.bankDestination.accountNumber,
      pay_reference: payoutReference,
      account_name: transaction.bankDestination.accountName,
    });

    await this.transactions.update(transaction.id, (current) => {
      if (current.payout) {
        return { ...current, lastEvent: event };
      }

      return {
        ...current,
        status: statusFromPayoutStatus(payout.data.status),
        quote: lockedQuote,
        payout: {
          id: payout.data.transaction_id,
          status: payout.data.status,
          amount: Number(payout.data.amount),
          currency: payout.data.currency,
        },
        references: appendReferences(current.references, [
          { type: "pay_reference", value: payout.data.pay_reference ?? payoutReference },
          { type: "swap", value: swapRes.data.swap_id },
          { type: "transfer", value: payout.data.transaction_id },
        ]),
        error:
          payout.data.status === "failed" ? "Skyewallet payout could not be initiated" : undefined,
        lastEvent: event,
      };
    });
  }

  private async startBankToCryptoSwap(
    transaction: BankToCryptoTransaction,
    event: SkyewalletWebhookEvent,
  ) {
    const payoutReference = buildPayReference(transaction.id, "payout");
    const receivedAmount =
      toNumber(getWebhookDataValue(event, "amount"), transaction.quote.fromAmount) ??
      transaction.quote.fromAmount;
    const quoteRes = await this.skyewallet.getSwapQuote({
      from_currency: "NGN",
      to_currency: transaction.payoutDestination.currency,
      from_amount: formatAmount(receivedAmount),
    });
    const preview = buildBankToCryptoQuote(quoteRes.data, receivedAmount);
    const swapRes = await this.skyewallet.executeSwap(quoteRes.data.quote_id);
    const lockedQuote = lockQuote(
      this.quotes.reviseQuoteFromSwap(transaction.direction, preview, {
        fromAmount: toNumber(swapRes.data.from_amount, preview.fromAmount),
        toAmount: toNumber(swapRes.data.to_amount, preview.grossAmount),
      }),
    );
    const payout = await this.skyewallet.createPayout({
      type: "crypto",
      amount: formatAmount(lockedQuote.netAmount),
      currency: transaction.payoutDestination.currency,
      address: transaction.payoutDestination.address,
      network: transaction.payoutDestination.network,
      pay_reference: payoutReference,
    });

    await this.transactions.update(transaction.id, (current) => {
      if (current.payout) {
        return { ...current, lastEvent: event };
      }

      return {
        ...current,
        status: statusFromPayoutStatus(payout.data.status),
        quote: lockedQuote,
        payout: {
          id: payout.data.transaction_id,
          status: payout.data.status,
          amount: Number(payout.data.amount),
          currency: payout.data.currency,
        },
        references: appendReferences(current.references, [
          { type: "pay_reference", value: payout.data.pay_reference ?? payoutReference },
          { type: "swap", value: swapRes.data.swap_id },
          { type: "transfer", value: payout.data.transaction_id },
        ]),
        error:
          payout.data.status === "failed" ? "Skyewallet payout could not be initiated" : undefined,
        lastEvent: event,
      };
    });
  }

  private async findMatchingTransaction(event: SkyewalletWebhookEvent) {
    const values = extractReferenceValues(event);
    const statuses =
      event.event === "payment.received" ? (["awaiting_payment"] as const) : undefined;

    for (const value of values) {
      const match = await this.transactions.findByReferenceValues([value], {
        statuses: statuses ? [...statuses] : undefined,
      });
      if (match) {
        return match;
      }
    }

    return null;
  }

  private async assertWithinLimits(
    ownerUserId: string,
    level: number,
    currency: string,
    amount: number,
  ) {
    const limits = getLevelLimits(level, currency);

    if (amount > limits.maxTransactionAmount) {
      throw new Error(
        `Amount exceeds your level limit of ${limits.maxTransactionAmount}. Upgrade your account to increase limits.`,
      );
    }

    const dailyVolume = await this.transactions.getDailyVolumeForOwner(ownerUserId, currency);
    if (dailyVolume + amount > limits.maxDailyAmount) {
      throw new Error(
        `Daily limit of ${limits.maxDailyAmount} exceeded. Upgrade your account to increase limits.`,
      );
    }
  }
}

function profileToCustomerProfile(
  profile: CustomerProfileRow,
): CryptoToBankTransaction["customer"] {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    email: profile.email ?? undefined,
    phone: profile.phone ?? undefined,
    level: profile.level as CustomerLevel,
    bvnVerified: profile.bvnVerified,
    ninVerified: profile.ninVerified,
    phoneVerified: profile.phoneVerified,
    addressVerified: profile.addressVerified,
    bvn: maskSensitiveIdentifier(profile.bvn),
    nin: maskSensitiveIdentifier(profile.nin),
    address: profile.address ?? undefined,
    city: profile.city ?? undefined,
    state: profile.state ?? undefined,
    country: profile.country,
    dateOfBirth: profile.dateOfBirth ?? undefined,
  };
}

function appendReferences(
  current: TransactionReference[],
  next: TransactionReference[],
): TransactionReference[] {
  const deduped = new Map<string, TransactionReference>();

  for (const reference of [...current, ...next]) {
    if (!reference.value) {
      continue;
    }

    deduped.set(`${reference.type}:${reference.value}`, reference);
  }

  return [...deduped.values()];
}

function valueOrEmpty(value: unknown) {
  return typeof value === "string" ? value : "";
}

function buildPayReference(transactionId: string, stage: "payin" | "payout") {
  return `${transactionId}:${stage}`;
}

function lockQuote(quote: QuotePreview): QuotePreview {
  return {
    ...quote,
    expiresAt: undefined,
  };
}

function statusFromPayoutStatus(status: string) {
  if (status === "completed") {
    return "completed" as const;
  }

  if (status === "failed") {
    return "failed" as const;
  }

  return "payout_pending" as const;
}

function getLevelLimits(level: number, currency: string) {
  const currencyLimits = currencyLevelLimits[currency];
  return (
    currencyLimits?.[level as keyof typeof currencyLimits] ??
    currencyLimits?.[0] ?? { maxTransactionAmount: Infinity, maxDailyAmount: Infinity }
  );
}
