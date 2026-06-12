import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { AuthRequired } from "../components/auth-required";
import { TransactionTimeline } from "../components/transaction-timeline";
import {
  createBankToCryptoTransaction,
  getBankToCryptoQuote,
  validateAddress,
  type QuoteResponse,
  type Transaction,
} from "../lib/api";
import { authClient } from "../lib/auth-client";
import { useLiveTransaction } from "../lib/live-transaction";
import {
  formatAsset,
  formatNaira,
  isTerminalStatus,
  statusLabel,
} from "../lib/transaction-ui";
import {
  formatCountdown,
  useRefreshCountdown,
  useSecondsRemaining,
} from "../lib/timers";

type Step = "setup" | "preview" | "account";

export function ReceivePage() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [step, setStep] = useState<Step>("setup");
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [quote, setQuote] = useState<QuoteResponse["quote"] | null>(null);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [liveAccountQuote, setLiveAccountQuote] =
    useState<QuoteResponse["quote"] | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isCreatingTransaction, setIsCreatingTransaction] = useState(false);
  const [isRefreshingPreviewQuote, setIsRefreshingPreviewQuote] = useState(false);
  const [isRefreshingAccountQuote, setIsRefreshingAccountQuote] = useState(false);
  const [isValidatingAddress, setIsValidatingAddress] = useState(false);
  const [form, setForm] = useState({
    amount: "10000",
    currency: "USDT" as "USDT" | "USDC",
    network: "TRX" as "TRX" | "SOL",
    address: "",
  });
  const isAwaitingAccountPayment =
    transaction?.direction === "bank_to_crypto" &&
    transaction.status === "awaiting_payment";
  const activeAccountQuote =
    isAwaitingAccountPayment
      ? liveAccountQuote ?? transaction.quote
      : transaction?.quote ?? null;
  const accountExpirySeconds = useSecondsRemaining(
    transaction?.direction === "bank_to_crypto"
      ? transaction.virtualAccount.expiresAt
      : undefined,
  );
  const isAccountExpired = accountExpirySeconds !== null && accountExpirySeconds === 0;

  useLiveTransaction({
    transaction,
    onUpdate: (nextTransaction) => {
      setTransaction(nextTransaction);
      setError(null);
    },
    onError: setError,
  });

  useEffect(() => {
    if (!transaction || transaction.direction !== "bank_to_crypto") {
      setLiveAccountQuote(null);
      return;
    }

    if (transaction.status !== "awaiting_payment") {
      setLiveAccountQuote(null);
      return;
    }

    setLiveAccountQuote((current) => current ?? transaction.quote);
  }, [transaction?.id, transaction?.status]);

  if (sessionPending) {
    return <p className="screen-message">Loading...</p>;
  }

  if (!session?.user) {
    return (
      <AuthRequired
        title="Receive flow"
        message="Sign in before creating a bank to crypto payout."
      />
    );
  }

  async function handleNext(event: FormEvent) {
    event.preventDefault();
    setFeedback(null);
    setError(null);
    setIsLoadingQuote(true);

    try {
      const response = await getBankToCryptoQuote({
        fromAmount: Number(form.amount),
        toCurrency: form.currency,
        network: form.network,
      });

      setQuote(response.quote);
      setStep("preview");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to load preview",
      );
    } finally {
      setIsLoadingQuote(false);
    }
  }

  async function handleAddressBlur() {
    if (!form.address.trim()) return;

    setIsValidatingAddress(true);
    setError(null);

    try {
      const result = await validateAddress({
        address: form.address,
        currency: form.currency,
        network: form.network,
      });

      if (!result.valid) {
        setError(result.message ?? `Invalid ${form.currency} address for ${form.network} network`);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to validate address");
    } finally {
      setIsValidatingAddress(false);
    }
  }

  async function refreshPreviewQuote() {
    if (step !== "preview") {
      return;
    }

    setIsRefreshingPreviewQuote(true);

    try {
      const response = await getBankToCryptoQuote({
        fromAmount: Number(form.amount),
        toCurrency: form.currency,
        network: form.network,
      });

      setQuote(response.quote);
      setError(null);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to refresh preview",
      );
    } finally {
      setIsRefreshingPreviewQuote(false);
    }
  }

  async function handleProceed() {
    setError(null);
    setFeedback(null);
    setIsCreatingTransaction(true);

    try {
      const response = await createBankToCryptoTransaction({
        fiat: {
          amount: Number(form.amount),
        },
        wallet: {
          address: form.address,
          currency: form.currency,
          network: form.network,
        },
      });

      setTransaction(response.transaction);
      setStep("account");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to create transaction",
      );
    } finally {
      setIsCreatingTransaction(false);
    }
  }

  async function refreshAccountQuote() {
    if (
      !transaction ||
      transaction.direction !== "bank_to_crypto" ||
      transaction.status !== "awaiting_payment"
    ) {
      return;
    }

    if (
      transaction.virtualAccount.expiresAt &&
      new Date(transaction.virtualAccount.expiresAt).getTime() <= Date.now()
    ) {
      return;
    }

    setIsRefreshingAccountQuote(true);

    try {
      const response = await getBankToCryptoQuote({
        fromAmount: transaction.quote.fromAmount,
        toCurrency: transaction.payoutDestination.currency as "USDT" | "USDC",
        network: transaction.payoutDestination.network as "TRX" | "SOL",
      });

      setLiveAccountQuote(response.quote);
      setError(null);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to refresh live payout quote",
      );
    } finally {
      setIsRefreshingAccountQuote(false);
    }
  }

  async function handleCopyAccountNumber() {
    if (!transaction || transaction.direction !== "bank_to_crypto") {
      return;
    }

    try {
      await navigator.clipboard.writeText(transaction.virtualAccount.accountNumber);
      setFeedback("Account number copied.");
    } catch {
      setError("Unable to copy the account number right now.");
    }
  }

  const previewRefreshSeconds = useRefreshCountdown({
    enabled: step === "preview" && Boolean(quote),
    onRefresh: refreshPreviewQuote,
  });

  const accountRefreshSeconds = useRefreshCountdown({
    enabled:
      transaction?.direction === "bank_to_crypto" &&
      transaction.status === "awaiting_payment" &&
      accountExpirySeconds !== null &&
      accountExpirySeconds > 0,
    onRefresh: refreshAccountQuote,
  });

  return (
    <div className="mobile-screen">
      <div className="screen-header">
        <span className="section-label">Receive</span>
        <strong>Bank to crypto</strong>
      </div>

      {step === "setup" ? (
        <form className="mobile-card form-stack" onSubmit={handleNext}>
          <label className="field-block">
            <span>Amount in NGN</span>
            <input
              type="number"
              min="100"
              step="100"
              value={form.amount}
              onChange={(event) => {
                setForm({ ...form, amount: event.target.value });
                setQuote(null);
                setFeedback(null);
              }}
              required
            />
          </label>

          <div className="two-column">
            <label className="field-block">
              <span>Settle in</span>
              <select
                value={form.currency}
                onChange={(event) => {
                  setForm({
                    ...form,
                    currency: event.target.value as "USDT" | "USDC",
                  });
                  setQuote(null);
                  setError(null);
                }}
              >
                <option value="USDT">USDT</option>
                <option value="USDC">USDC</option>
              </select>
            </label>

            <label className="field-block">
              <span>Network</span>
              <select
                value={form.network}
                onChange={(event) => {
                  setForm({
                    ...form,
                    network: event.target.value as "TRX" | "SOL",
                  });
                  setQuote(null);
                  setError(null);
                }}
              >
                <option value="TRX">TRX</option>
                <option value="SOL">SOL</option>
              </select>
            </label>
          </div>

          <label className="field-block">
            <span>Wallet address</span>
            <textarea
              rows={4}
              value={form.address}
              onChange={(event) => {
                setForm({ ...form, address: event.target.value });
                setError(null);
              }}
              onBlur={() => void handleAddressBlur()}
              required
            />
          </label>

          {isValidatingAddress ? <p className="muted">Validating address...</p> : null}
          {error ? <p className="error-text">{error}</p> : null}
          {feedback ? <p className="success-text">{feedback}</p> : null}

          <button
            className="button button-primary button-block"
            type="submit"
            disabled={isLoadingQuote}
          >
            {isLoadingQuote ? "Loading preview..." : "Next"}
          </button>
        </form>
      ) : null}

      {step === "preview" && quote ? (
        <section className="mobile-card mobile-card-spaced">
          <span className="section-label">Estimated quote</span>
          <div className="amount-emphasis">
            <strong>{formatNaira(quote.fromAmount)}</strong>
            <span>You will receive this as crypto</span>
          </div>
          <div className="inline-note countdown-note">
            <div className="summary-row">
              <span>Rate refresh</span>
              <strong>
                {isRefreshingPreviewQuote || previewRefreshSeconds === 0
                  ? "Refreshing..."
                  : formatCountdown(previewRefreshSeconds)}
              </strong>
            </div>
          </div>
          <p className="muted">
            This quote can change with market rates until your payment is received.
            Once the transfer lands, the transaction continues on the locked amount.
          </p>
          <div className="mobile-summary-list">
            <div className="summary-row">
              <span>Estimated crypto payout</span>
              <strong>{formatAsset(quote.netAmount, quote.toCurrency)}</strong>
            </div>
            <div className="summary-row">
              <span>Fee</span>
              <strong>{formatAsset(quote.linkpayFee, quote.toCurrency)}</strong>
            </div>
            <div className="summary-row">
              <span>Wallet</span>
              <strong className="mono">{form.address}</strong>
            </div>
          </div>
          {error ? <p className="error-text">{error}</p> : null}
          <div className="stacked-actions">
            <button
              className="button button-primary button-block"
              type="button"
              onClick={() => {
                void handleProceed();
              }}
              disabled={isCreatingTransaction}
            >
              {isCreatingTransaction ? "Generating account..." : "Proceed"}
            </button>
            <button
              className="button button-secondary button-block"
              type="button"
              onClick={() => setStep("setup")}
            >
              Back
            </button>
          </div>
        </section>
      ) : null}

      {step === "account" &&
      transaction &&
      transaction.direction === "bank_to_crypto" ? (
        <>
          <section className="mobile-card mobile-card-spaced">
            <span className="section-label">Send NGN here</span>
            <div className="amount-emphasis">
              <strong>{transaction.virtualAccount.bankName}</strong>
              <span>{transaction.virtualAccount.accountName}</span>
            </div>
            <div className="copy-card">
              <span className="section-label">Account number</span>
              <strong className="mono">
                {transaction.virtualAccount.accountNumber}
              </strong>
              <button
                className="button button-primary button-block"
                type="button"
                onClick={() => {
                  void handleCopyAccountNumber();
                }}
              >
                Copy account number
              </button>
            </div>
            <p className="muted">
              Send exactly {formatNaira(transaction.quote.fromAmount)} to this
              account. Any other amount will not be processed.
            </p>
            {isAwaitingAccountPayment && transaction.virtualAccount.expiresAt ? (
              accountExpirySeconds === 0 ? (
                <p className="error-text">
                  This account expired{" "}
                  {new Date(transaction.virtualAccount.expiresAt).toLocaleString()}.
                  A new transaction will generate a fresh account.
                </p>
              ) : (
                <div className="inline-note countdown-note">
                  <div className="summary-row">
                    <span>Account expiry</span>
                    <strong>{formatCountdown(accountExpirySeconds)}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Expires at</span>
                    <strong>
                      {new Date(transaction.virtualAccount.expiresAt).toLocaleString()}
                    </strong>
                  </div>
                </div>
              )
            ) : null}
            {isAwaitingAccountPayment && activeAccountQuote ? (
              <div className="inline-note countdown-note">
                <div className="summary-row">
                  <span>Rate refresh</span>
                  <strong>
                    {isRefreshingAccountQuote || accountRefreshSeconds === 0
                      ? "Refreshing..."
                      : formatCountdown(accountRefreshSeconds)}
                  </strong>
                </div>
              </div>
            ) : null}
            {isAwaitingAccountPayment ? (
              <p className="muted">
                The bank transfer amount is locked. The crypto payout stays
                estimated until your transfer is received and the swap is executed.
              </p>
            ) : null}
            <div className="mobile-summary-list">
              <div className="summary-row">
                <span>
                  {isAwaitingAccountPayment
                    ? "Estimated crypto payout"
                    : "Crypto payout"}
                </span>
                <strong>
                  {formatAsset(
                    activeAccountQuote?.netAmount,
                    transaction.payoutDestination.currency,
                  )}
                </strong>
              </div>
            </div>
          </section>

          <section className="mobile-card mobile-card-spaced">
            <div className="summary-row">
              <span>Status</span>
              <span className={`status-badge ${isAccountExpired ? "status-expired" : `status-${transaction.status}`}`}>
                {isAccountExpired ? statusLabel("expired") : statusLabel(transaction.status)}
              </span>
            </div>
            <TransactionTimeline tx={transaction} />
            <div className="mobile-summary-list">
              <div className="summary-row">
                <span>Wallet payout</span>
                <strong>{transaction.payoutDestination.currency}</strong>
              </div>
              <div className="summary-row">
                <span>Network</span>
                <strong>{transaction.payoutDestination.network}</strong>
              </div>
            </div>
            {transaction.error ? <p className="error-text">{transaction.error}</p> : null}
            {feedback ? <p className="success-text">{feedback}</p> : null}
          </section>

          {isTerminalStatus(transaction.status) ? (
            <section className="mobile-card mobile-card-spaced">
              <span className="section-label">Next</span>
              <strong>
                {transaction.status === "completed"
                  ? "Payout completed."
                  : "Transaction closed."}
              </strong>
              <div className="stacked-actions">
                <Link
                  to="/app/transactions/$id"
                  params={{ id: transaction.id }}
                  className="button button-primary button-block"
                >
                  View transaction details
                </Link>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
