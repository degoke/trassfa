import { useEffect, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { AuthRequired } from "../components/auth-required";
import {
  getTransaction,
  type QuoteResponse,
  type Transaction,
} from "../lib/api";
import { authClient } from "../lib/auth-client";
import { useLiveTransaction } from "../lib/live-transaction";
import {
  buildReceiptShareText,
  formatAsset,
  formatDateTime,
  formatNaira,
  getTransactionDirectionLabel,
  statusLabel,
} from "../lib/transaction-ui";

function ReceiptRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="receipt-row">
      <span className="receipt-label">{label}</span>
      <strong className={`receipt-value${mono ? " mono" : ""}`}>{value}</strong>
    </div>
  );
}

export function TransactionReceiptPage() {
  const { id } = useParams({ from: "/app/transactions/$id/receipt" });
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [tx, setTx] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user) {
      setLoading(false);
      return;
    }

    getTransaction(id)
      .then((response) => setTx(response.transaction))
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [id, session?.user]);

  useLiveTransaction({
    transaction: tx,
    onUpdate: (nextTransaction) => {
      setTx(nextTransaction);
      setError(null);
    },
    onError: setError,
  });

  if (sessionPending || loading) {
    return <p className="screen-message">Loading...</p>;
  }

  if (!session?.user) {
    return (
      <AuthRequired
        title="Receipt"
        message="Sign in to view transaction receipts."
      />
    );
  }

  if (error && !tx) {
    return (
      <div className="mobile-screen">
        <p className="error-text">{error}</p>
        <Link
          to="/app/transactions"
          className="button button-secondary button-block"
        >
          Back to history
        </Link>
      </div>
    );
  }

  if (!tx) {
    return (
      <div className="mobile-screen">
        <p className="screen-message">Transaction not found.</p>
        <Link
          to="/app/transactions"
          className="button button-secondary button-block"
        >
          Back to history
        </Link>
      </div>
    );
  }

  const displayQuote: QuoteResponse["quote"] = tx.quote;
  const payoutValue =
    tx.direction === "crypto_to_bank"
      ? formatNaira(displayQuote.netAmount)
      : formatAsset(displayQuote.netAmount, displayQuote.toCurrency);
  const paidValue =
    tx.direction === "crypto_to_bank"
      ? formatAsset(displayQuote.fromAmount, displayQuote.fromCurrency)
      : formatNaira(displayQuote.fromAmount);

  async function handleShareReceipt() {
    const currentTx = tx;
    if (!currentTx) {
      return;
    }

    setShareError(null);
    const text = buildReceiptShareText(currentTx);

    try {
      if (navigator.share) {
        await navigator.share({ title: "trassfa receipt", text });
        setFeedback("Receipt shared.");
        return;
      }

      await navigator.clipboard.writeText(text);
      setFeedback("Receipt copied.");
    } catch {
      setShareError("Unable to share the receipt right now.");
    }
  }

  return (
    <div className="mobile-screen">
      <div className="screen-header">
        <span className="section-label">Receipt</span>
        <strong>{getTransactionDirectionLabel(tx)}</strong>
      </div>

      <section className="mobile-card mobile-card-spaced receipt-sheet">
        <div className="receipt-header">
          <span className="section-label">Receipt</span>
          <span className={`status-badge status-${tx.status}`}>
            {statusLabel(tx.status)}
          </span>
        </div>

        <div className="receipt-amount">
          <strong>{payoutValue}</strong>
          <span>Amount settled</span>
        </div>

        <div className="receipt-divider" />

        <div>
          <span className="receipt-section-title">Reference</span>
          <div className="receipt-rows">
            <ReceiptRow label="Transaction ID" value={tx.id} mono />
            <ReceiptRow label="Type" value={getTransactionDirectionLabel(tx)} />
            <ReceiptRow label="Created" value={formatDateTime(tx.createdAt)} />
            <ReceiptRow label="Status" value={statusLabel(tx.status)} />
          </div>
        </div>

        <div className="receipt-divider" />

        <div>
          <span className="receipt-section-title">Details</span>
          <div className="receipt-rows">
            <ReceiptRow
              label={tx.direction === "crypto_to_bank" ? "You sent" : "You paid"}
              value={paidValue}
            />
            {tx.direction === "crypto_to_bank" ? (
              <>
                <ReceiptRow label="Recipient" value={tx.bankDestination.accountName} />
                <ReceiptRow
                  label="Account"
                  value={tx.bankDestination.accountNumber}
                  mono
                />
              </>
            ) : (
              <>
                <ReceiptRow
                  label="Wallet"
                  value={tx.payoutDestination.address}
                  mono
                />
                <ReceiptRow label="Network" value={tx.payoutDestination.network} />
              </>
            )}
            {tx.payout ? (
              <ReceiptRow
                label="Payout ref"
                value={tx.payout.id}
                mono
              />
            ) : null}
          </div>
        </div>

        {shareError ? <p className="error-text">{shareError}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
        {feedback ? <p className="success-text">{feedback}</p> : null}

        <div className="stacked-actions">
          <button
            className="button button-primary button-block"
            type="button"
            onClick={() => {
              void handleShareReceipt();
            }}
          >
            Share receipt
          </button>
          <Link
            to="/app/transactions/$id"
            params={{ id: tx.id }}
            className="button button-secondary button-block"
          >
            Back to details
          </Link>
        </div>
      </section>
    </div>
  );
}
