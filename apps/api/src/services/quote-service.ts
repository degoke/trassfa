import { feeConfig } from "../config/fee.js";
import type { QuotePreview } from "../lib/domain.js";
import { Decimal, calculateFee, money, roundAmount } from "../lib/money.js";
import { SkyewalletClient } from "../lib/skyewallet.js";
import type { BankToCryptoQuoteInput, CryptoToBankQuoteInput } from "../routes/schemas.js";

export class QuoteService {
  constructor(private readonly skyewallet: SkyewalletClient) {}

  async quoteCryptoToBank(input: CryptoToBankQuoteInput) {
    if (input.toAmount) {
      return this.quoteByToAmount(input);
    }

    const rateRes = await this.skyewallet.getRate(input.fromCurrency, "NGN");

    return buildCryptoToBankRatePreview(rateRes.data, input.fromAmount!);
  }

  private async quoteByToAmount(input: CryptoToBankQuoteInput) {
    const rateRes = await this.skyewallet.getRate(input.fromCurrency, "NGN");
    const rate = money(rateRes.data.rate);
    const targetNetAmount = money(input.toAmount!);
    const targetGrossAmount = grossFromNetAmount(
      targetNetAmount,
      feeConfig.PLATFORM_FEE_BPS,
      feeConfig.PLATFORM_FEE_FLAT_NGN,
    );

    return buildCryptoToBankRatePreview(
      rateRes.data,
      roundAmount(targetGrossAmount.div(rate)),
      roundAmount(targetGrossAmount),
    );
  }

  async quoteBankToCrypto(input: BankToCryptoQuoteInput) {
    const rateRes = await this.skyewallet.getRate("NGN", input.toCurrency);

    return buildBankToCryptoRatePreview(rateRes.data, input.fromAmount);
  }

  reviseQuoteFromSwap(
    direction: "crypto_to_bank" | "bank_to_crypto",
    quote: QuotePreview,
    input: { fromAmount?: number; toAmount?: number },
  ) {
    const grossAmount = roundAmount(input.toAmount ?? quote.grossAmount);
    const fromAmount = roundAmount(input.fromAmount ?? quote.fromAmount);
    const fees = calculateFee(
      grossAmount,
      feeConfig.PLATFORM_FEE_BPS,
      direction === "crypto_to_bank" ? feeConfig.PLATFORM_FEE_FLAT_NGN : 0,
    );

    return {
      ...quote,
      fromAmount,
      grossAmount,
      platformFee: roundAmount(fees.platformFee),
      netAmount: roundAmount(fees.netAmount),
    };
  }
}

function buildCryptoToBankRatePreview(
  rate: Awaited<ReturnType<SkyewalletClient["getRate"]>>["data"],
  fromAmount: number,
  grossAmountOverride?: number,
): QuotePreview {
  const grossAmount = roundAmount(grossAmountOverride ?? money(fromAmount).mul(rate.rate));
  const fees = calculateFee(
    grossAmount,
    feeConfig.PLATFORM_FEE_BPS,
    feeConfig.PLATFORM_FEE_FLAT_NGN,
  );

  return {
    quoteId: "preview",
    fromCurrency: rate.from,
    toCurrency: rate.to,
    fromAmount: roundAmount(fromAmount),
    grossAmount,
    providerFee: 0,
    platformFee: roundAmount(fees.platformFee),
    netAmount: roundAmount(fees.netAmount),
    rate: roundAmount(rate.rate),
    expiresAt: undefined,
  };
}

function buildBankToCryptoRatePreview(
  rate: Awaited<ReturnType<SkyewalletClient["getRate"]>>["data"],
  fromAmount: number,
): QuotePreview {
  const grossAmount = roundAmount(money(fromAmount).mul(rate.rate));
  const fees = calculateFee(grossAmount, feeConfig.PLATFORM_FEE_BPS, 0);

  return {
    quoteId: "preview",
    fromCurrency: rate.from,
    toCurrency: rate.to,
    fromAmount: roundAmount(fromAmount),
    grossAmount,
    providerFee: 0,
    platformFee: roundAmount(fees.platformFee),
    netAmount: roundAmount(fees.netAmount),
    rate: roundAmount(rate.rate),
    expiresAt: undefined,
  };
}

export function buildCryptoToBankQuote(
  quote: Awaited<ReturnType<SkyewalletClient["getSwapQuote"]>>["data"],
  fromAmount: number,
): QuotePreview {
  const grossAmount = roundAmount(quote.to_amount);
  const providerFee = roundAmount(quote.fee);
  const fees = calculateFee(
    grossAmount,
    feeConfig.PLATFORM_FEE_BPS,
    feeConfig.PLATFORM_FEE_FLAT_NGN,
  );

  return {
    quoteId: quote.quote_id,
    fromCurrency: quote.from_currency,
    toCurrency: quote.to_currency,
    fromAmount,
    grossAmount,
    providerFee,
    platformFee: roundAmount(fees.platformFee),
    netAmount: roundAmount(fees.netAmount),
    rate: roundAmount(quote.rate),
    expiresAt: quote.expires_at,
  };
}

export function buildBankToCryptoQuote(
  quote: Awaited<ReturnType<SkyewalletClient["getSwapQuote"]>>["data"],
  fromAmount: number,
): QuotePreview {
  const grossAmount = roundAmount(quote.to_amount);
  const providerFee = roundAmount(quote.fee);
  const fees = calculateFee(grossAmount, feeConfig.PLATFORM_FEE_BPS, 0);

  return {
    quoteId: quote.quote_id,
    fromCurrency: quote.from_currency,
    toCurrency: quote.to_currency,
    fromAmount,
    grossAmount,
    providerFee,
    platformFee: roundAmount(fees.platformFee),
    netAmount: roundAmount(fees.netAmount),
    rate: roundAmount(quote.rate),
    expiresAt: quote.expires_at,
  };
}

function grossFromNetAmount(netAmount: Decimal, feeBps: number, flatFee: number) {
  const percentageMultiplier = money(1).minus(money(feeBps).div(10_000));
  if (percentageMultiplier.lte(0)) {
    throw new Error("Invalid fee configuration");
  }

  return netAmount.plus(flatFee).div(percentageMultiplier);
}
