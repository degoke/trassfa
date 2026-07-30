import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { AuthRequired } from "../components/auth-required";
import { TransactionTimeline } from "../components/transaction-timeline";
import {
  getBankToCryptoQuote,
  getCryptoToBankQuote,
  getTransaction,
  type QuoteResponse,
  type Transaction,
} from "../lib/api";
import { authClient } from "../lib/auth-client";
import { useLiveTransaction } from "../lib/live-transaction";
import {
  formatAsset,
  formatDateTime,
  formatNaira,
  getTransactionDirectionLabel,
  statusLabel,
} from "../lib/transaction-ui";
import { formatCountdown, useRefreshCountdown, useSecondsRemaining } from "../lib/timers";

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="summary-row">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mobile-card mobile-card-spaced">
      <span className="section-label">{title}</span>
      <div className="mobile-summary-list">{children}</div>
    </section>
  );
}

export function TransactionPage() {
  const { id } = useParams({ from: "/app/transactions/$id" });
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [tx, setTx] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [liveQuote, setLiveQuote] = useState<QuoteResponse["quote"] | null>(null);
  const [isRefreshingQuote, setIsRefreshingQuote] = useState(false);

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

  useEffect(() => {
    if (!tx || tx.status !== "awaiting_payment") {
      setLiveQuote(null);
      return;
    }

    setLiveQuote((current) => current ?? tx.quote);
  }, [tx?.id, tx?.status]);

  const activeQuote =
    tx?.status === "awaiting_payment" ? (liveQuote ?? tx.quote) : (tx?.quote ?? null);
  const paymentExpirySeconds = useSecondsRemaining(
    tx?.direction === "crypto_to_bank"
      ? tx.deposit.expiresAt
      : tx?.direction === "bank_to_crypto"
        ? tx.virtualAccount.expiresAt
        : undefined,
  );

  async function refreshPendingQuote() {
    if (!tx || tx.status !== "awaiting_payment") {
      return;
    }

    const currentTx = tx;

    if (
      currentTx.direction === "crypto_to_bank"
        ? currentTx.deposit.expiresAt &&
          new Date(currentTx.deposit.expiresAt).getTime() <= Date.now()
        : currentTx.virtualAccount.expiresAt &&
          new Date(currentTx.virtualAccount.expiresAt).getTime() <= Date.now()
    ) {
      return;
    }
    setIsRefreshingQuote(true);

    try {
      const response =
        currentTx.direction === "crypto_to_bank"
          ? await getCryptoToBankQuote({
              fromAmount: currentTx.deposit.amount,
              fromCurrency: currentTx.deposit.currency as "USDT" | "USDC",
              network: currentTx.deposit.network as "TRX" | "SOL",
            })
          : await getBankToCryptoQuote({
              fromAmount: currentTx.quote.fromAmount,
              toCurrency: currentTx.payoutDestination.currency as "USDT" | "USDC",
              network: currentTx.payoutDestination.network as "TRX" | "SOL",
            });

      setLiveQuote(response.quote);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to refresh live quote");
    } finally {
      setIsRefreshingQuote(false);
    }
  }

  const refreshSeconds = useRefreshCountdown({
    enabled:
      tx?.status === "awaiting_payment" &&
      paymentExpirySeconds !== null &&
      paymentExpirySeconds > 0,
    onRefresh: refreshPendingQuote,
  });

  if (sessionPending || loading) {
    return <p className="screen-message">Loading...</p>;
  }

  if (!session?.user) {
    return (
      <AuthRequired
        title="Transaction details"
        message="Sign in to view transaction status and receipts."
      />
    );
  }

  if (error && !tx) {
    return (
      <div className="mobile-screen">
        <p className="error-text">{error}</p>
        <Link to="/app/transactions" className="button button-secondary button-block">
          Back to history
        </Link>
      </div>
    );
  }

  if (!tx) {
    return (
      <div className="mobile-screen">
        <p className="screen-message">Transaction not found.</p>
        <Link to="/app/transactions" className="button button-secondary button-block">
          Back to history
        </Link>
      </div>
    );
  }

  const displayQuote = activeQuote ?? tx.quote;
  const isEstimate = tx.status === "awaiting_payment";
  const isAwaitingPayment = tx.status === "awaiting_payment";
  const isPaymentExpired = paymentExpirySeconds !== null && paymentExpirySeconds === 0;
  const payoutValue =
    tx.direction === "crypto_to_bank"
      ? formatNaira(displayQuote.netAmount)
      : formatAsset(displayQuote.netAmount, displayQuote.toCurrency);

  async function handleCopyPrimaryDetail() {
    setError(null);
    const currentTx = tx;

    if (!currentTx) {
      return;
    }

    try {
      if (currentTx.direction === "crypto_to_bank") {
        await navigator.clipboard.writeText(currentTx.deposit.address);
        setFeedback("Wallet address copied.");
        return;
      }

      await navigator.clipboard.writeText(currentTx.virtualAccount.accountNumber);
      setFeedback("Account number copied.");
    } catch {
      setError("Unable to copy the payment details right now.");
    }
  }

  return (
    <div className="mobile-screen">
      <div className="screen-header">
        <span className="section-label">Transaction details</span>
        <strong>{getTransactionDirectionLabel(tx)}</strong>
      </div>

      {tx.direction === "crypto_to_bank" ? (
        <section className="mobile-card mobile-card-spaced">
          <span className="section-label">
            {isPaymentExpired
              ? "Address expired"
              : isAwaitingPayment
                ? "Send this crypto"
                : "Crypto payment details"}
          </span>
          <div className="amount-emphasis">
            <strong>{formatAsset(tx.deposit.amount, tx.deposit.currency)}</strong>
            <span>{tx.deposit.network} network</span>
          </div>
          <div className="copy-card">
            <span className="section-label">Wallet address</span>
            <strong className="mono">{tx.deposit.address}</strong>
            <button
              className="button button-primary button-block"
              type="button"
              onClick={() => {
                void handleCopyPrimaryDetail();
              }}
            >
              Copy wallet address
            </button>
          </div>
          <p className="muted">
            {isPaymentExpired
              ? "This payment address has expired. A new transaction will generate a fresh address."
              : isAwaitingPayment
                ? `Send exactly ${formatAsset(tx.deposit.amount, tx.deposit.currency)} on ${tx.deposit.network} to this wallet.`
                : "Payment details are locked. Follow the status card below for payout progress."}
          </p>
          {isAwaitingPayment && !isPaymentExpired ? (
            <div className="inline-note countdown-note">
              <div className="summary-row">
                <span>Rate refresh</span>
                <strong>
                  {isRefreshingQuote || refreshSeconds === 0
                    ? "Refreshing..."
                    : formatCountdown(refreshSeconds)}
                </strong>
              </div>
              <div className="summary-row">
                <span>Address expiry</span>
                <strong>
                  {paymentExpirySeconds === null
                    ? "--"
                    : paymentExpirySeconds > 0
                      ? formatCountdown(paymentExpirySeconds)
                      : "Expired"}
                </strong>
              </div>
            </div>
          ) : null}
          <div className="mobile-summary-list">
            <div className="summary-row">
              <span>Recipient</span>
              <strong>{tx.bankDestination.accountName}</strong>
            </div>
            <div className="summary-row">
              <span>{isEstimate ? "Estimated naira payout" : "Naira payout"}</span>
              <strong>{payoutValue}</strong>
            </div>
          </div>
        </section>
      ) : (
        <section className="mobile-card mobile-card-spaced">
          <span className="section-label">
            {isPaymentExpired
              ? "Account expired"
              : isAwaitingPayment
                ? "Send NGN here"
                : "Bank payment details"}
          </span>
          <div className="amount-emphasis">
            <strong>{tx.virtualAccount.bankName}</strong>
            <span>{tx.virtualAccount.accountName}</span>
          </div>
          <div className="copy-card">
            <span className="section-label">Account number</span>
            <strong className="mono">{tx.virtualAccount.accountNumber}</strong>
            <button
              className="button button-primary button-block"
              type="button"
              onClick={() => {
                void handleCopyPrimaryDetail();
              }}
            >
              Copy account number
            </button>
          </div>
          <p className="muted">
            {isPaymentExpired
              ? "This account has expired. Create a new transaction for a fresh virtual account."
              : isAwaitingPayment
                ? `Send exactly ${formatNaira(tx.quote.fromAmount)} to this account.`
                : "Transfer details are locked. Follow the status card below for payout progress."}
          </p>
          {isAwaitingPayment && !isPaymentExpired ? (
            <div className="inline-note countdown-note">
              <div className="summary-row">
                <span>Rate refresh</span>
                <strong>
                  {isRefreshingQuote || refreshSeconds === 0
                    ? "Refreshing..."
                    : formatCountdown(refreshSeconds)}
                </strong>
              </div>
              <div className="summary-row">
                <span>Account expiry</span>
                <strong>
                  {paymentExpirySeconds === null
                    ? "--"
                    : paymentExpirySeconds > 0
                      ? formatCountdown(paymentExpirySeconds)
                      : "Expired"}
                </strong>
              </div>
            </div>
          ) : null}
          <div className="mobile-summary-list">
            <div className="summary-row">
              <span>Wallet</span>
              <strong className="mono">{tx.payoutDestination.address}</strong>
            </div>
            <div className="summary-row">
              <span>{isEstimate ? "Estimated crypto payout" : "Crypto payout"}</span>
              <strong>{payoutValue}</strong>
            </div>
          </div>
        </section>
      )}

      <section className="mobile-card mobile-card-spaced">
        <div className="summary-row">
          <span>Status</span>
          <span
            className={`status-badge ${isPaymentExpired ? "status-expired" : `status-${tx.status}`}`}
          >
            {isPaymentExpired ? statusLabel("expired") : statusLabel(tx.status)}
          </span>
        </div>
        <TransactionTimeline tx={tx} />
        {isPaymentExpired ? (
          <p className="error-text">
            The payment account has expired. This transaction will be closed soon.
          </p>
        ) : isEstimate ? (
          <p className="muted">
            This transaction is still using a live estimate. Once payment is received, the quote
            locks and the payout continues automatically.
          </p>
        ) : null}
        {error ? <p className="error-text">{error}</p> : null}
        {feedback ? <p className="success-text">{feedback}</p> : null}
        <div className="stacked-actions">
          <Link
            to="/app/transactions/$id/receipt"
            params={{ id: tx.id }}
            className="button button-primary button-block"
          >
            View receipt
          </Link>
          <Link to="/app/transactions" className="button button-secondary button-block">
            Back to history
          </Link>
        </div>
      </section>

      <DetailSection title="Transaction">
        <DetailRow label="Transaction ID">
          <span className="mono">{tx.id}</span>
        </DetailRow>
        <DetailRow label="Created">{formatDateTime(tx.createdAt)}</DetailRow>
        <DetailRow label="Updated">{formatDateTime(tx.updatedAt)}</DetailRow>
      </DetailSection>

      {tx.direction === "crypto_to_bank" ? (
        <DetailSection title="Recipient">
          <DetailRow label="Bank">
            {tx.bankDestination.bankName ?? tx.bankDestination.bankCode}
          </DetailRow>
          <DetailRow label="Account name">{tx.bankDestination.accountName}</DetailRow>
          <DetailRow label="Account number">{tx.bankDestination.accountNumber}</DetailRow>
        </DetailSection>
      ) : (
        <DetailSection title="Destination wallet">
          <DetailRow label="Currency">{tx.payoutDestination.currency}</DetailRow>
          <DetailRow label="Network">{tx.payoutDestination.network}</DetailRow>
          <DetailRow label="Address">
            <span className="mono">{tx.payoutDestination.address}</span>
          </DetailRow>
        </DetailSection>
      )}

      <DetailSection title={isEstimate ? "Estimated breakdown" : "Breakdown"}>
        <DetailRow label={tx.direction === "crypto_to_bank" ? "You send" : "You pay"}>
          {tx.direction === "crypto_to_bank"
            ? formatAsset(displayQuote.fromAmount, displayQuote.fromCurrency)
            : formatNaira(displayQuote.fromAmount)}
        </DetailRow>
        <DetailRow label="Gross">
          {tx.direction === "crypto_to_bank"
            ? formatNaira(displayQuote.grossAmount)
            : formatAsset(displayQuote.grossAmount, displayQuote.toCurrency)}
        </DetailRow>
        <DetailRow label="Provider fee">
          {tx.direction === "crypto_to_bank"
            ? formatNaira(displayQuote.providerFee)
            : formatAsset(displayQuote.providerFee, displayQuote.toCurrency)}
        </DetailRow>
        <DetailRow label="trassfa fee">
          {tx.direction === "crypto_to_bank"
            ? formatNaira(displayQuote.platformFee)
            : formatAsset(displayQuote.platformFee, displayQuote.toCurrency)}
        </DetailRow>
        <DetailRow label={isEstimate ? "Estimated payout" : "Payout amount"}>
          {payoutValue}
        </DetailRow>
      </DetailSection>

      {tx.direction === "crypto_to_bank" ? (
        <DetailSection title="Payment source">
          <DetailRow label="Currency">{tx.deposit.currency}</DetailRow>
          <DetailRow label="Network">{tx.deposit.network}</DetailRow>
          <DetailRow label="Wallet address">
            <span className="mono">{tx.deposit.address}</span>
          </DetailRow>
        </DetailSection>
      ) : (
        <DetailSection title="Payment source">
          <DetailRow label="Bank">{tx.virtualAccount.bankName}</DetailRow>
          <DetailRow label="Account name">{tx.virtualAccount.accountName}</DetailRow>
          <DetailRow label="Account number">
            <span className="mono">{tx.virtualAccount.accountNumber}</span>
          </DetailRow>
        </DetailSection>
      )}

      {tx.payout ? (
        <DetailSection title="Payout">
          <DetailRow label="Status">{tx.payout.status}</DetailRow>
          <DetailRow label="Amount">{formatAsset(tx.payout.amount, tx.payout.currency)}</DetailRow>
          <DetailRow label="Reference">
            <span className="mono">{tx.payout.id}</span>
          </DetailRow>
        </DetailSection>
      ) : null}

      {tx.error ? (
        <section className="mobile-card mobile-card-spaced">
          <span className="section-label">Error</span>
          <p className="error-text">{tx.error}</p>
        </section>
      ) : null}
    </div>
  );
}
