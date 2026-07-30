import { describe, expect, it, vi } from "vitest";
import { feeConfig } from "../config/fee.js";
import type { QuotePreview } from "../lib/domain.js";
import { SkyewalletClient } from "../lib/skyewallet.js";
import { QuoteService, buildBankToCryptoQuote, buildCryptoToBankQuote } from "./quote-service.js";

const swapQuote = {
  quote_id: "quote_123",
  from_currency: "USDT",
  to_currency: "NGN",
  from_amount: "100",
  to_amount: "150000",
  fee: "250",
  rate: "1500",
  expires_at: "2024-06-01T12:05:00.000Z",
};

describe("buildCryptoToBankQuote", () => {
  it("applies platform fees on top of provider fees", () => {
    const quote = buildCryptoToBankQuote(swapQuote, 100);

    expect(quote.quoteId).toBe("quote_123");
    expect(quote.fromAmount).toBe(100);
    expect(quote.grossAmount).toBe(150_000);
    expect(quote.providerFee).toBe(250);
    expect(quote.platformFee).toBeGreaterThan(0);
    expect(quote.netAmount).toBeLessThan(quote.grossAmount);
  });
});

describe("buildBankToCryptoQuote", () => {
  it("does not apply the flat NGN fee for bank-to-crypto quotes", () => {
    const quote = buildBankToCryptoQuote(swapQuote, 100_000);

    expect(quote.platformFee).toBe(
      buildCryptoToBankQuote(swapQuote, 100).platformFee - feeConfig.PLATFORM_FEE_FLAT_NGN,
    );
  });
});

describe("QuoteService", () => {
  it("revises crypto-to-bank quotes from a target settlement amount", () => {
    const service = new QuoteService({} as SkyewalletClient);
    const preview: QuotePreview = {
      quoteId: "preview",
      fromCurrency: "USDT",
      toCurrency: "NGN",
      fromAmount: 10,
      grossAmount: 15_000,
      providerFee: 0,
      platformFee: 230,
      netAmount: 14_770,
      rate: 1_500,
    };

    const revised = service.reviseQuoteFromSwap("crypto_to_bank", preview, {
      toAmount: 20_000,
    });

    expect(revised.grossAmount).toBe(20_000);
    expect(revised.netAmount).toBeLessThan(20_000);
    expect(revised.platformFee).toBeGreaterThan(preview.platformFee);
  });

  it("fetches rate previews for bank-to-crypto quotes", async () => {
    const skyewallet = {
      getRate: vi.fn().mockResolvedValue({
        data: {
          from: "NGN",
          to: "USDT",
          rate: 0.00065,
        },
      }),
    } as unknown as SkyewalletClient;

    const service = new QuoteService(skyewallet);
    const quote = await service.quoteBankToCrypto({
      toCurrency: "USDT",
      network: "TRX",
      fromAmount: 100_000,
    });

    expect(skyewallet.getRate).toHaveBeenCalledWith("NGN", "USDT");
    expect(quote.fromAmount).toBe(100_000);
    expect(quote.toCurrency).toBe("USDT");
    expect(quote.grossAmount).toBeGreaterThan(0);
  });

  it("fetches rate previews for crypto-to-bank quotes", async () => {
    const skyewallet = {
      getRate: vi.fn().mockResolvedValue({
        data: {
          from: "USDT",
          to: "NGN",
          rate: 1_500,
        },
      }),
    } as unknown as SkyewalletClient;

    const service = new QuoteService(skyewallet);
    const quote = await service.quoteCryptoToBank({
      fromCurrency: "USDT",
      network: "TRX",
      fromAmount: 100,
    });

    expect(skyewallet.getRate).toHaveBeenCalledWith("USDT", "NGN");
    expect(quote.fromAmount).toBe(100);
    expect(quote.netAmount).toBeLessThan(quote.grossAmount);
  });
});
