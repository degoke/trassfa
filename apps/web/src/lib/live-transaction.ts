import { useEffect, useRef } from "react";
import { getTransaction, type Transaction } from "./api";
import { isTerminalStatus } from "./transaction-ui";

const LIVE_TRANSACTION_POLL_INTERVAL_MS = 10_000;

export function useLiveTransaction({
  transaction,
  onUpdate,
  onError,
  intervalMs = LIVE_TRANSACTION_POLL_INTERVAL_MS,
}: {
  transaction: Transaction | null;
  onUpdate: (transaction: Transaction) => void;
  onError: (message: string) => void;
  intervalMs?: number;
}) {
  const updateRef = useRef(onUpdate);
  const errorRef = useRef(onError);
  const transactionId = transaction?.id;
  const transactionStatus = transaction?.status;

  useEffect(() => {
    updateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    errorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (!transactionId || !transactionStatus || isTerminalStatus(transactionStatus)) {
      return;
    }

    let active = true;

    const refresh = async () => {
      try {
        const response = await getTransaction(transactionId);
        if (!active) {
          return;
        }

        updateRef.current(response.transaction);
      } catch (reason) {
        if (!active) {
          return;
        }

        errorRef.current(
          reason instanceof Error
            ? reason.message
            : "Unable to refresh transaction",
        );
      }
    };

    void refresh();

    const intervalId = window.setInterval(() => {
      void refresh();
    }, intervalMs);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [intervalMs, transactionId, transactionStatus]);
}
