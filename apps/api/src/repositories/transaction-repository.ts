import { and, desc, eq, gte, inArray, notInArray } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  customerProfileTable,
  depositBankDestinationTable,
  payoutDetailsTable,
  quotePreviewTable,
  transactionReferencesTable,
  transactionsTable,
  type CustomerProfileRow,
  type DepositBankDestinationRow,
  type PayoutDetailsRowRaw,
  type QuotePreviewRow,
  type TransactionReferenceRow,
  type TransactionRow,
} from "../db/schema.js";
import type {
  CustomerLevel,
  CustomerProfile,
  TrassfaTransaction,
  PayoutDetails,
  QuotePreview,
  TransactionReference,
} from "../lib/domain.js";
import { maskSensitiveIdentifier } from "../lib/encryption.js";

export class TransactionRepository {
  async listByOwner(ownerUserId: string) {
    const rows = await db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.ownerUserId, ownerUserId))
      .orderBy(desc(transactionsTable.createdAt));

    if (rows.length === 0) {
      return [];
    }

    const profile = await this.getCustomerProfile(ownerUserId);
    const ids = rows.map((row) => row.id);
    const [destRows, quoteRows, payoutRows, refRows] = await Promise.all([
      this.getDestinations(ids),
      this.getQuotes(ids),
      this.getPayouts(ids),
      this.getReferences(ids),
    ]);
    const destMap = mapByTransactionId(destRows);
    const quoteMap = mapByTransactionId(quoteRows);
    const payoutMap = mapByTransactionId(payoutRows);
    const refMap = groupReferences(refRows);

    return rows.map((row) =>
      mapTransaction(
        row,
        profile,
        destMap.get(row.id) ?? null,
        quoteMap.get(row.id) ?? null,
        payoutMap.get(row.id) ?? null,
        refMap.get(row.id) ?? [],
      ),
    );
  }

  async findById(id: string) {
    const row = await db.query.transactionsTable.findFirst({
      where: eq(transactionsTable.id, id),
    });

    if (!row) {
      return null;
    }

    const [profile, destRow, quoteRow, payoutRow, refs] = await Promise.all([
      this.getCustomerProfile(row.ownerUserId),
      this.getDestination(id),
      this.getQuote(id),
      this.getPayout(id),
      this.getTransactionReferences(id),
    ]);

    return mapTransaction(row, profile, destRow, quoteRow, payoutRow, refs);
  }

  async findByIdForOwner(id: string, ownerUserId: string) {
    const row = await db.query.transactionsTable.findFirst({
      where: and(eq(transactionsTable.id, id), eq(transactionsTable.ownerUserId, ownerUserId)),
    });

    if (!row) {
      return null;
    }

    const [profile, destRow, quoteRow, payoutRow, refs] = await Promise.all([
      this.getCustomerProfile(row.ownerUserId),
      this.getDestination(id),
      this.getQuote(id),
      this.getPayout(id),
      this.getTransactionReferences(id),
    ]);

    return mapTransaction(row, profile, destRow, quoteRow, payoutRow, refs);
  }

  async create(transaction: TrassfaTransaction) {
    await db.transaction(async (tx) => {
      await tx
        .insert(customerProfileTable)
        .values({
          userId: transaction.ownerUserId,
          firstName: transaction.customer.firstName,
          lastName: transaction.customer.lastName,
          email: transaction.customer.email ?? null,
          phone: transaction.customer.phone ?? null,
        })
        .onConflictDoUpdate({
          target: customerProfileTable.userId,
          set: {
            firstName: transaction.customer.firstName,
            lastName: transaction.customer.lastName,
            email: transaction.customer.email ?? null,
            phone: transaction.customer.phone ?? null,
            updatedAt: new Date(),
          },
        });

      await tx.insert(transactionsTable).values({
        id: transaction.id,
        ownerUserId: transaction.ownerUserId,
        direction: transaction.direction,
        status: transaction.status,
        skyewalletCustomerId: transaction.skyewalletCustomerId,
        createdAt: new Date(transaction.createdAt),
        updatedAt: new Date(transaction.updatedAt),
      });

      await tx.insert(quotePreviewTable).values({
        transactionId: transaction.id,
        quoteId: transaction.quote.quoteId,
        fromCurrency: transaction.quote.fromCurrency,
        toCurrency: transaction.quote.toCurrency,
        fromAmount: String(transaction.quote.fromAmount),
        grossAmount: String(transaction.quote.grossAmount),
        providerFee: String(transaction.quote.providerFee),
        linkpayFee: String(transaction.quote.platformFee),
        netAmount: String(transaction.quote.netAmount),
        rate: String(transaction.quote.rate),
        expiresAt: transaction.quote.expiresAt ?? null,
      });

      await tx.insert(depositBankDestinationTable).values(toDestinationRow(transaction));

      await this.insertReferences(tx, transaction.id, transaction.references);
    });

    return (await this.findById(transaction.id))!;
  }

  async update(id: string, updater: (current: TrassfaTransaction) => TrassfaTransaction) {
    return await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(transactionsTable)
        .where(eq(transactionsTable.id, id))
        .for("update");

      if (rows.length === 0) {
        throw new Error(`Transaction ${id} not found`);
      }

      const row = rows[0]!;
      const profile = await this.getCustomerProfileInTx(tx, row.ownerUserId);
      const destRow = await this.getDestinationInTx(tx, id);
      const quoteRow = await this.getQuoteInTx(tx, id);
      const payoutRow = await this.getPayoutInTx(tx, id);
      const refs = await this.getTransactionReferencesInTx(tx, id);

      const current = mapTransaction(row, profile, destRow, quoteRow, payoutRow, refs);
      const next = {
        ...updater(current),
        updatedAt: new Date().toISOString(),
      } satisfies TrassfaTransaction;

      await tx
        .update(transactionsTable)
        .set({
          ownerUserId: next.ownerUserId,
          direction: next.direction,
          status: next.status,
          skyewalletCustomerId: next.skyewalletCustomerId,
          lastEvent: next.lastEvent ?? null,
          error: next.error ?? null,
          updatedAt: new Date(),
        })
        .where(eq(transactionsTable.id, id));

      await tx
        .insert(quotePreviewTable)
        .values({
          transactionId: id,
          quoteId: next.quote.quoteId,
          fromCurrency: next.quote.fromCurrency,
          toCurrency: next.quote.toCurrency,
          fromAmount: String(next.quote.fromAmount),
          grossAmount: String(next.quote.grossAmount),
          providerFee: String(next.quote.providerFee),
          linkpayFee: String(next.quote.platformFee),
          netAmount: String(next.quote.netAmount),
          rate: String(next.quote.rate),
          expiresAt: next.quote.expiresAt ?? null,
        })
        .onConflictDoUpdate({
          target: quotePreviewTable.transactionId,
          set: {
            quoteId: next.quote.quoteId,
            fromCurrency: next.quote.fromCurrency,
            toCurrency: next.quote.toCurrency,
            fromAmount: String(next.quote.fromAmount),
            grossAmount: String(next.quote.grossAmount),
            providerFee: String(next.quote.providerFee),
            linkpayFee: String(next.quote.platformFee),
            netAmount: String(next.quote.netAmount),
            rate: String(next.quote.rate),
            expiresAt: next.quote.expiresAt ?? null,
            updatedAt: new Date(),
          },
        });

      if (next.payout) {
        await tx
          .insert(payoutDetailsTable)
          .values({
            transactionId: id,
            payoutId: next.payout.id,
            status: next.payout.status,
            amount: String(next.payout.amount),
            currency: next.payout.currency,
          })
          .onConflictDoUpdate({
            target: payoutDetailsTable.transactionId,
            set: {
              payoutId: next.payout.id,
              status: next.payout.status,
              amount: String(next.payout.amount),
              currency: next.payout.currency,
              updatedAt: new Date(),
            },
          });
      }

      await this.insertReferences(tx, id, next.references);

      return mapTransaction(
        {
          ...row,
          status: next.status,
          skyewalletCustomerId: next.skyewalletCustomerId,
          lastEvent: next.lastEvent ?? null,
          error: next.error ?? null,
          updatedAt: new Date(),
        },
        profile,
        destRow,
        quoteRow,
        next.payout
          ? ({ ...payoutRow!, ...toPayoutRow(next.payout) } as PayoutDetailsRowRaw)
          : payoutRow,
        refs,
      );
    });
  }

  async findByReferenceValues(
    values: string[],
    options?: { statuses?: Array<TrassfaTransaction["status"]> },
  ) {
    if (values.length === 0) {
      return null;
    }

    const statusFilter = options?.statuses?.length
      ? inArray(transactionsTable.status, options.statuses)
      : undefined;

    const matchedRows = await db
      .select({
        reference: transactionReferencesTable,
        transaction: transactionsTable,
      })
      .from(transactionReferencesTable)
      .innerJoin(
        transactionsTable,
        eq(transactionReferencesTable.transactionId, transactionsTable.id),
      )
      .where(
        statusFilter
          ? and(inArray(transactionReferencesTable.value, values), statusFilter)
          : inArray(transactionReferencesTable.value, values),
      )
      .orderBy(desc(transactionsTable.createdAt))
      .limit(1);

    const matched = matchedRows[0];
    if (!matched) {
      return null;
    }

    const transaction = await this.findById(matched.transaction.id);
    if (!transaction) {
      return null;
    }

    return {
      transaction,
      matchedReference: mapReference(matched.reference),
    };
  }

  async getDailyVolumeForOwner(ownerUserId: string, currency: string) {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const rows = await db
      .select({
        fromAmount: quotePreviewTable.fromAmount,
        fromCurrency: quotePreviewTable.fromCurrency,
      })
      .from(transactionsTable)
      .innerJoin(quotePreviewTable, eq(quotePreviewTable.transactionId, transactionsTable.id))
      .where(
        and(
          eq(transactionsTable.ownerUserId, ownerUserId),
          gte(transactionsTable.createdAt, startOfDay),
          notInArray(transactionsTable.status, ["failed", "expired"]),
        ),
      );

    return rows
      .filter((row) => row.fromCurrency === currency)
      .reduce((total, row) => total + Number(row.fromAmount), 0);
  }

  async getCustomerProfile(userId: string): Promise<CustomerProfileRow | null> {
    return (
      (await db.query.customerProfileTable.findFirst({
        where: eq(customerProfileTable.userId, userId),
      })) ?? null
    );
  }

  private async getDestination(transactionId: string) {
    return (
      (await db.query.depositBankDestinationTable.findFirst({
        where: eq(depositBankDestinationTable.transactionId, transactionId),
      })) ?? null
    );
  }

  private async getDestinations(transactionIds: string[]) {
    if (transactionIds.length === 0) return [];
    return db
      .select()
      .from(depositBankDestinationTable)
      .where(inArray(depositBankDestinationTable.transactionId, transactionIds));
  }

  private async getQuote(transactionId: string) {
    return (
      (await db.query.quotePreviewTable.findFirst({
        where: eq(quotePreviewTable.transactionId, transactionId),
      })) ?? null
    );
  }

  private async getQuotes(transactionIds: string[]) {
    if (transactionIds.length === 0) return [];
    return db
      .select()
      .from(quotePreviewTable)
      .where(inArray(quotePreviewTable.transactionId, transactionIds));
  }

  private async getPayout(transactionId: string) {
    return (
      (await db.query.payoutDetailsTable.findFirst({
        where: eq(payoutDetailsTable.transactionId, transactionId),
      })) ?? null
    );
  }

  private async getPayouts(transactionIds: string[]) {
    if (transactionIds.length === 0) return [];
    return db
      .select()
      .from(payoutDetailsTable)
      .where(inArray(payoutDetailsTable.transactionId, transactionIds));
  }

  private async getTransactionReferences(transactionId: string) {
    return db
      .select()
      .from(transactionReferencesTable)
      .where(eq(transactionReferencesTable.transactionId, transactionId));
  }

  private async getReferences(transactionIds: string[]) {
    if (transactionIds.length === 0) return [];
    return db
      .select()
      .from(transactionReferencesTable)
      .where(inArray(transactionReferencesTable.transactionId, transactionIds));
  }

  private async getCustomerProfileInTx(tx: any, userId: string) {
    const rows = await tx
      .select()
      .from(customerProfileTable)
      .where(eq(customerProfileTable.userId, userId));
    return (rows[0] as CustomerProfileRow | undefined) ?? null;
  }

  private async getDestinationInTx(tx: any, transactionId: string) {
    const rows = await tx
      .select()
      .from(depositBankDestinationTable)
      .where(eq(depositBankDestinationTable.transactionId, transactionId));
    return (rows[0] as DepositBankDestinationRow | undefined) ?? null;
  }

  private async getQuoteInTx(tx: any, transactionId: string) {
    const rows = await tx
      .select()
      .from(quotePreviewTable)
      .where(eq(quotePreviewTable.transactionId, transactionId));
    return (rows[0] as QuotePreviewRow | undefined) ?? null;
  }

  private async getPayoutInTx(tx: any, transactionId: string) {
    const rows = await tx
      .select()
      .from(payoutDetailsTable)
      .where(eq(payoutDetailsTable.transactionId, transactionId));
    return (rows[0] as PayoutDetailsRowRaw | undefined) ?? null;
  }

  private async getTransactionReferencesInTx(tx: any, transactionId: string) {
    return tx
      .select()
      .from(transactionReferencesTable)
      .where(eq(transactionReferencesTable.transactionId, transactionId)) as Promise<
      TransactionReferenceRow[]
    >;
  }

  private async insertReferences(
    tx: any,
    transactionId: string,
    references: TransactionReference[],
  ) {
    const deduped = uniqueReferences(references).map((reference) => ({
      transactionId,
      type: reference.type,
      value: reference.value,
    }));

    if (deduped.length === 0) {
      return;
    }

    await tx
      .insert(transactionReferencesTable)
      .values(deduped)
      .onConflictDoNothing({
        target: [
          transactionReferencesTable.transactionId,
          transactionReferencesTable.type,
          transactionReferencesTable.value,
        ],
      });
  }
}

function mapTransaction(
  row: TransactionRow,
  profile: CustomerProfileRow | null,
  destRow: DepositBankDestinationRow | null,
  quoteRow: QuotePreviewRow | null,
  payoutRow: PayoutDetailsRowRaw | null,
  referenceRows: TransactionReferenceRow[],
): TrassfaTransaction {
  const base = {
    id: row.id,
    ownerUserId: row.ownerUserId,
    direction: row.direction,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    customer: profile
      ? mapCustomerProfile(profile)
      : ({
          firstName: "",
          lastName: "",
          level: 0 as CustomerLevel,
          bvnVerified: false,
          ninVerified: false,
          phoneVerified: false,
          addressVerified: false,
          country: "NG",
        } satisfies CustomerProfile),
    skyewalletCustomerId: row.skyewalletCustomerId,
    quote: quoteRow ? mapQuotePreview(quoteRow) : ({} as QuotePreview),
    payout: payoutRow ? mapPayoutDetails(payoutRow) : undefined,
    references: referenceRows.map(mapReference),
    lastEvent: row.lastEvent ?? undefined,
    error: row.error ?? undefined,
  };

  if (row.direction === "crypto_to_bank") {
    return {
      ...base,
      direction: "crypto_to_bank",
      deposit: {
        currency: destRow?.depositCurrency ?? "",
        network: destRow?.depositNetwork ?? "",
        amount: Number(destRow?.depositAmount ?? 0),
        accountId: destRow?.depositAccountId ?? "",
        address: destRow?.depositAddress ?? "",
        expiresAt: destRow?.depositExpiresAt ?? undefined,
      },
      bankDestination: {
        countryCode: destRow?.bankCountryCode ?? "",
        bankCode: destRow?.bankCode ?? "",
        bankName: destRow?.bankName ?? undefined,
        accountNumber: destRow?.bankAccountNumber ?? "",
        accountName: destRow?.bankAccountName ?? "",
      },
    };
  }

  return {
    ...base,
    direction: "bank_to_crypto",
    virtualAccount: {
      accountId: destRow?.virtualAccountId ?? "",
      bankName: destRow?.virtualBankName ?? "",
      accountNumber: destRow?.virtualAccountNumber ?? "",
      accountName: destRow?.virtualAccountName ?? "",
      expiresAt: destRow?.virtualAccountExpiresAt ?? undefined,
    },
    payoutDestination: {
      address: destRow?.payoutAddress ?? "",
      currency: destRow?.payoutCurrency ?? "",
      network: destRow?.payoutNetwork ?? "",
    },
  };
}

function toDestinationRow(
  transaction: TrassfaTransaction,
): typeof depositBankDestinationTable.$inferInsert {
  const base = {
    transactionId: transaction.id,
    direction: transaction.direction,
  };

  if (transaction.direction === "crypto_to_bank") {
    return {
      ...base,
      depositCurrency: transaction.deposit.currency,
      depositNetwork: transaction.deposit.network,
      depositAmount: String(transaction.deposit.amount),
      depositAccountId: transaction.deposit.accountId,
      depositAddress: transaction.deposit.address,
      depositExpiresAt: transaction.deposit.expiresAt ?? null,
      bankCountryCode: transaction.bankDestination.countryCode,
      bankCode: transaction.bankDestination.bankCode,
      bankName: transaction.bankDestination.bankName ?? null,
      bankAccountNumber: transaction.bankDestination.accountNumber,
      bankAccountName: transaction.bankDestination.accountName,
    };
  }

  return {
    ...base,
    virtualAccountId: transaction.virtualAccount.accountId,
    virtualBankName: transaction.virtualAccount.bankName,
    virtualAccountNumber: transaction.virtualAccount.accountNumber,
    virtualAccountName: transaction.virtualAccount.accountName,
    virtualAccountExpiresAt: transaction.virtualAccount.expiresAt ?? null,
    payoutAddress: transaction.payoutDestination.address,
    payoutCurrency: transaction.payoutDestination.currency,
    payoutNetwork: transaction.payoutDestination.network,
  };
}

function toPayoutRow(payout: PayoutDetails): Partial<PayoutDetailsRowRaw> {
  return {
    payoutId: payout.id,
    status: payout.status,
    amount: String(payout.amount),
    currency: payout.currency,
  } as Partial<PayoutDetailsRowRaw>;
}

function mapCustomerProfile(row: CustomerProfileRow): CustomerProfile {
  return {
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    level: row.level as CustomerProfile["level"],
    bvnVerified: row.bvnVerified,
    ninVerified: row.ninVerified,
    phoneVerified: row.phoneVerified,
    addressVerified: row.addressVerified,
    bvn: maskSensitiveIdentifier(row.bvn),
    nin: maskSensitiveIdentifier(row.nin),
    address: row.address ?? undefined,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    country: row.country,
    dateOfBirth: row.dateOfBirth ?? undefined,
  };
}

function mapQuotePreview(row: QuotePreviewRow): QuotePreview {
  return {
    quoteId: row.quoteId,
    fromCurrency: row.fromCurrency,
    toCurrency: row.toCurrency,
    fromAmount: Number(row.fromAmount),
    grossAmount: Number(row.grossAmount),
    providerFee: Number(row.providerFee),
    platformFee: Number(row.linkpayFee),
    netAmount: Number(row.netAmount),
    rate: Number(row.rate),
    expiresAt: row.expiresAt ?? undefined,
  };
}

function mapPayoutDetails(row: PayoutDetailsRowRaw): PayoutDetails {
  return {
    id: row.payoutId,
    status: row.status,
    amount: Number(row.amount),
    currency: row.currency,
  };
}

function mapReference(reference: TransactionReferenceRow): TransactionReference {
  return {
    type: reference.type as TransactionReference["type"],
    value: reference.value,
  };
}

function mapByTransactionId<T extends { transactionId: string }>(rows: T[]) {
  const map = new Map<string, T>();

  for (const row of rows) {
    map.set(row.transactionId, row);
  }

  return map;
}

function groupReferences(referenceRows: TransactionReferenceRow[]) {
  const grouped = new Map<string, TransactionReferenceRow[]>();

  for (const row of referenceRows) {
    const bucket = grouped.get(row.transactionId) ?? [];
    bucket.push(row);
    grouped.set(row.transactionId, bucket);
  }

  return grouped;
}

function uniqueReferences(references: TransactionReference[]) {
  const seen = new Set<string>();

  return references.filter((reference) => {
    const key = `${reference.type}:${reference.value}`;
    if (!reference.value || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
