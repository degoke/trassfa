import { describe, expect, it } from "vitest";
import {
  bankResolutionSchema,
  bankToCryptoQuoteSchema,
  bankToCryptoTransactionSchema,
  cryptoToBankQuoteSchema,
  cryptoToBankTransactionSchema,
} from "./schemas.js";

describe("cryptoToBankQuoteSchema", () => {
  it("accepts fromAmount quotes with defaults", () => {
    const parsed = cryptoToBankQuoteSchema.parse({ fromAmount: 100 });

    expect(parsed).toEqual({
      fromCurrency: "USDT",
      network: "TRX",
      fromAmount: 100,
    });
  });

  it("requires either fromAmount or toAmount", () => {
    expect(() => cryptoToBankQuoteSchema.parse({})).toThrow(
      "Either fromAmount or toAmount must be provided",
    );
  });
});

describe("bankToCryptoQuoteSchema", () => {
  it("requires a positive fromAmount", () => {
    expect(() => bankToCryptoQuoteSchema.parse({ fromAmount: 0 })).toThrow();
  });
});

describe("bankResolutionSchema", () => {
  it("requires either bankCode or bankName", () => {
    expect(() =>
      bankResolutionSchema.parse({
        accountNumber: "0123456789",
      }),
    ).toThrow("Either bankCode or bankName is required");
  });

  it("accepts a bank code and 10-digit account number", () => {
    const parsed = bankResolutionSchema.parse({
      bankCode: "058",
      accountNumber: "0123456789",
    });

    expect(parsed.bankCode).toBe("058");
    expect(parsed.countryCode).toBe("NG");
  });
});

describe("transaction schemas", () => {
  it("validates crypto-to-bank transaction payloads", () => {
    const parsed = cryptoToBankTransactionSchema.parse({
      deposit: {
        fromCurrency: "USDT",
        network: "TRX",
        fromAmount: 100,
      },
      bank: {
        bankCode: "058",
        accountNumber: "0123456789",
      },
    });

    expect(parsed.deposit.fromAmount).toBe(100);
    expect(parsed.bank.accountNumber).toBe("0123456789");
  });

  it("validates bank-to-crypto transaction payloads", () => {
    const parsed = bankToCryptoTransactionSchema.parse({
      fiat: { amount: 50_000 },
      wallet: {
        address: "TXyz1234567890",
        currency: "USDT",
        network: "TRX",
      },
    });

    expect(parsed.fiat.amount).toBe(50_000);
    expect(parsed.wallet.address).toBe("TXyz1234567890");
  });
});
