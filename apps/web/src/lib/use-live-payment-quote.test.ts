import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useLivePaymentQuote } from "./use-live-payment-quote";
import { createCryptoToBankTransaction } from "../test/fixtures";

describe("useLivePaymentQuote", () => {
  it("uses the transaction quote while awaiting payment", () => {
    const transaction = createCryptoToBankTransaction({
      status: "awaiting_payment",
    });

    const { result } = renderHook(() =>
      useLivePaymentQuote({
        transaction,
        direction: "crypto_to_bank",
      }),
    );

    expect(result.current.isAwaitingPayment).toBe(true);
    expect(result.current.activeQuote?.quoteId).toBe("quote_1");
  });

  it("clears live quotes after payment is received", () => {
    const transaction = createCryptoToBankTransaction({
      status: "payment_received",
    });

    const { result } = renderHook(() =>
      useLivePaymentQuote({
        transaction,
        direction: "crypto_to_bank",
      }),
    );

    expect(result.current.isAwaitingPayment).toBe(false);
    expect(result.current.liveQuote).toBeNull();
    expect(result.current.activeQuote?.quoteId).toBe("quote_1");
  });
});
