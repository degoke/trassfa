import { useEffect, useState } from "react";
import type { QuoteResponse, Transaction } from "./api";

export function useLivePaymentQuote<T extends Transaction>({
  transaction,
  direction,
}: {
  transaction: T | null;
  direction: T["direction"];
}) {
  const [liveQuote, setLiveQuote] = useState<QuoteResponse["quote"] | null>(null);
  const isAwaitingPayment =
    transaction?.direction === direction && transaction.status === "awaiting_payment";
  const activeQuote = isAwaitingPayment
    ? (liveQuote ?? transaction?.quote ?? null)
    : (transaction?.quote ?? null);

  useEffect(() => {
    if (!transaction || transaction.direction !== direction) {
      setLiveQuote(null);
      return;
    }

    if (transaction.status !== "awaiting_payment") {
      setLiveQuote(null);
      return;
    }

    setLiveQuote((current) => current ?? transaction.quote);
  }, [transaction?.id, transaction?.status, direction]);

  return {
    liveQuote,
    setLiveQuote,
    isAwaitingPayment,
    activeQuote,
  };
}
