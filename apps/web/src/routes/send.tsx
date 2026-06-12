import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { AuthRequired } from "../components/auth-required";
import { TransactionTimeline } from "../components/transaction-timeline";
import {
  createCryptoToBankTransaction,
  getCryptoToBankQuote,
  listBanks,
  resolveBankAccount,
  type Bank,
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

const ACCOUNT_NUMBER_LENGTH = 10;

type Step = "setup" | "preview" | "funding";
type InputMode = "crypto" | "ngn";

export function SendPage() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [step, setStep] = useState<Step>("setup");
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [quote, setQuote] = useState<QuoteResponse["quote"] | null>(null);
  const [resolvedName, setResolvedName] = useState("");
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [liveFundingQuote, setLiveFundingQuote] =
    useState<QuoteResponse["quote"] | null>(null);
  const [isLoadingBanks, setIsLoadingBanks] = useState(true);
  const [isResolvingAccount, setIsResolvingAccount] = useState(false);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isCreatingTransaction, setIsCreatingTransaction] = useState(false);
  const [isRefreshingPreviewQuote, setIsRefreshingPreviewQuote] = useState(false);
  const [isRefreshingFundingQuote, setIsRefreshingFundingQuote] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>("ngn");
  const [form, setForm] = useState({
    amount: "10000",
    fromCurrency: "USDT" as "USDT" | "USDC",
    network: "TRX" as "TRX" | "SOL",
    bankCode: "",
    accountNumber: "",
  });
  const lastResolvedKey = useRef("");

  const selectedBank = banks.find((bank) => bank.code === form.bankCode) ?? null;
  const isAwaitingFundingPayment =
    transaction?.direction === "crypto_to_bank" &&
    transaction.status === "awaiting_payment";
  const activeFundingQuote =
    isAwaitingFundingPayment
      ? liveFundingQuote ?? transaction.quote
      : transaction?.quote ?? null;
  const depositExpirySeconds = useSecondsRemaining(
    transaction?.direction === "crypto_to_bank"
      ? transaction.deposit.expiresAt
      : undefined,
  );
  const isDepositExpired = depositExpirySeconds !== null && depositExpirySeconds === 0;

  useEffect(() => {
    if (!session?.user) {
      setIsLoadingBanks(false);
      return;
    }

    setIsLoadingBanks(true);
    listBanks()
      .then((response) => setBanks(response.banks))
      .catch((reason) => setError(reason.message))
      .finally(() => setIsLoadingBanks(false));
  }, [session?.user]);

  useLiveTransaction({
    transaction,
    onUpdate: (nextTransaction) => {
      setTransaction(nextTransaction);
      setError(null);
    },
    onError: setError,
  });

  useEffect(() => {
    if (!transaction || transaction.direction !== "crypto_to_bank") {
      setLiveFundingQuote(null);
      return;
    }

    if (transaction.status !== "awaiting_payment") {
      setLiveFundingQuote(null);
      return;
    }

    setLiveFundingQuote((current) => current ?? transaction.quote);
  }, [transaction?.id, transaction?.status]);

  if (sessionPending) {
    return <p className="screen-message">Loading...</p>;
  }

  if (!session?.user) {
    return (
      <AuthRequired
        title="Send flow"
        message="Sign in before creating a crypto to bank payout."
      />
    );
  }

  async function ensureResolvedAccount() {
    if (!form.bankCode) {
      setError("Select a bank first.");
      return null;
    }

    if (form.accountNumber.length !== ACCOUNT_NUMBER_LENGTH) {
      setError("Enter a valid 10-digit account number.");
      return null;
    }

    const requestKey = `${form.bankCode}:${form.accountNumber}`;
    if (requestKey === lastResolvedKey.current && resolvedName) {
      return resolvedName;
    }

    setIsResolvingAccount(true);
    setError(null);

    try {
      const resolved = await resolveBankAccount({
        countryCode: "NG",
        bankCode: form.bankCode,
        accountNumber: form.accountNumber,
      });

      lastResolvedKey.current = requestKey;
      setResolvedName(resolved.accountName);
      return resolved.accountName;
    } catch (reason) {
      setResolvedName("");
      setError(
        reason instanceof Error ? reason.message : "Unable to resolve account",
      );
      return null;
    } finally {
      setIsResolvingAccount(false);
    }
  }

  async function handleNext(event: FormEvent) {
    event.preventDefault();
    setFeedback(null);

    const accountName = await ensureResolvedAccount();
    if (!accountName) {
      return;
    }

    setIsLoadingQuote(true);
    setError(null);

    try {
      const response = await getCryptoToBankQuote(
        inputMode === "ngn"
          ? {
              fromCurrency: form.fromCurrency,
              network: form.network,
              toAmount: Number(form.amount),
            }
          : {
              fromCurrency: form.fromCurrency,
              network: form.network,
              fromAmount: Number(form.amount),
            },
      );

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

  async function refreshPreviewQuote() {
    if (step !== "preview") {
      return;
    }

    setIsRefreshingPreviewQuote(true);

    try {
      const response = await getCryptoToBankQuote(
        inputMode === "ngn"
          ? {
              fromCurrency: form.fromCurrency,
              network: form.network,
              toAmount: Number(form.amount),
            }
          : {
              fromCurrency: form.fromCurrency,
              network: form.network,
              fromAmount: Number(form.amount),
            },
      );

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
    if (!quote) {
      return;
    }

    setIsCreatingTransaction(true);
    setError(null);
    setFeedback(null);

    const cryptoAmount =
      inputMode === "ngn" ? quote.fromAmount : Number(form.amount);

    try {
      const response = await createCryptoToBankTransaction({
        deposit: {
          fromAmount: cryptoAmount,
          fromCurrency: form.fromCurrency,
          network: form.network,
          ...(inputMode === "ngn" ? { toAmount: quote.netAmount } : {}),
        },
        bank: {
          countryCode: "NG",
          bankCode: form.bankCode,
          accountNumber: form.accountNumber,
        },
      });

      setTransaction(response.transaction);
      setStep("funding");
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

  async function refreshFundingQuote() {
    if (
      !transaction ||
      transaction.direction !== "crypto_to_bank" ||
      transaction.status !== "awaiting_payment"
    ) {
      return;
    }

    if (
      transaction.deposit.expiresAt &&
      new Date(transaction.deposit.expiresAt).getTime() <= Date.now()
    ) {
      return;
    }

    setIsRefreshingFundingQuote(true);

    try {
      const response = await getCryptoToBankQuote({
        fromAmount: transaction.deposit.amount,
        fromCurrency: transaction.deposit.currency as "USDT" | "USDC",
        network: transaction.deposit.network as "TRX" | "SOL",
      });

      setLiveFundingQuote(response.quote);
      setError(null);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to refresh live payout quote",
      );
    } finally {
      setIsRefreshingFundingQuote(false);
    }
  }

  async function handleCopyAddress() {
    if (!transaction || transaction.direction !== "crypto_to_bank") {
      return;
    }

    try {
      await navigator.clipboard.writeText(transaction.deposit.address);
      setFeedback("Wallet address copied.");
    } catch {
      setError("Unable to copy the wallet address right now.");
    }
  }

  const previewRefreshSeconds = useRefreshCountdown({
    enabled: step === "preview" && Boolean(quote),
    onRefresh: refreshPreviewQuote,
  });

  const fundingRefreshSeconds = useRefreshCountdown({
    enabled:
      transaction?.direction === "crypto_to_bank" &&
      transaction.status === "awaiting_payment" &&
      depositExpirySeconds !== null &&
      depositExpirySeconds > 0,
    onRefresh: refreshFundingQuote,
  });

  return (
    <div className="mobile-screen">
      <div className="screen-header">
        <span className="section-label">Send</span>
        <strong>Crypto to bank</strong>
      </div>

      {step === "setup" ? (
        <form className="mobile-card form-stack" onSubmit={handleNext}>
          <div className="segmented-control">
            <button
              type="button"
              className={inputMode === "ngn" ? "segment active" : "segment"}
              onClick={() => setInputMode("ngn")}
            >
              Naira
            </button>
            <button
              type="button"
              className={inputMode === "crypto" ? "segment active" : "segment"}
              onClick={() => setInputMode("crypto")}
            >
              Crypto
            </button>
          </div>

          <label className="field-block">
            <span>Amount</span>
            <input
              type="number"
              min="1"
              step={inputMode === "ngn" ? "1" : "0.01"}
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
              <span>Currency</span>
              <select
                value={form.fromCurrency}
                onChange={(event) => {
                  setForm({
                    ...form,
                    fromCurrency: event.target.value as "USDT" | "USDC",
                  });
                  setQuote(null);
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
                }}
              >
                <option value="TRX">TRX</option>
                <option value="SOL">SOL</option>
              </select>
            </label>
          </div>

          <BankPicker
            banks={banks}
            selectedBank={selectedBank}
            loading={isLoadingBanks}
            onSelect={(bankCode) => {
              setForm({ ...form, bankCode });
              setResolvedName("");
              setQuote(null);
              lastResolvedKey.current = "";
            }}
          />

          <label className="field-block">
            <span>Account number</span>
            <input
              inputMode="numeric"
              maxLength={ACCOUNT_NUMBER_LENGTH}
              value={form.accountNumber}
              onChange={(event) => {
                setForm({
                  ...form,
                  accountNumber: event.target.value.replace(/\D/g, ""),
                });
                setResolvedName("");
                setQuote(null);
                lastResolvedKey.current = "";
              }}
              onBlur={() => {
                void ensureResolvedAccount();
              }}
              required
            />
          </label>

          {resolvedName ? (
            <div className="inline-note">
              <span className="section-label">Account name</span>
              <strong>{resolvedName}</strong>
            </div>
          ) : null}

          {isResolvingAccount ? (
            <p className="screen-message">Resolving account...</p>
          ) : null}
          {error ? <p className="error-text">{error}</p> : null}
          {feedback ? <p className="success-text">{feedback}</p> : null}

          <button
            className="button button-primary button-block"
            type="submit"
            disabled={isLoadingQuote || isResolvingAccount}
          >
            {isLoadingQuote ? "Loading preview..." : "Next"}
          </button>
        </form>
      ) : null}

      {step === "preview" && quote ? (
        <section className="mobile-card mobile-card-spaced">
          <span className="section-label">Estimated quote</span>
          <div className="amount-emphasis">
            <strong>{formatAsset(quote.fromAmount, quote.fromCurrency)}</strong>
            <span>You will send</span>
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
              <span>Estimated recipient gets</span>
              <strong>{formatNaira(quote.netAmount)}</strong>
            </div>
            <div className="summary-row">
              <span>Fee</span>
              <strong>{formatNaira(quote.linkpayFee)}</strong>
            </div>
            <div className="summary-row">
              <span>Bank</span>
              <strong>{selectedBank?.name ?? "Selected bank"}</strong>
            </div>
            <div className="summary-row">
              <span>Account</span>
              <strong>
                {resolvedName} • {form.accountNumber}
              </strong>
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
              {isCreatingTransaction ? "Generating wallet..." : "Proceed"}
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

      {step === "funding" &&
      transaction &&
      transaction.direction === "crypto_to_bank" ? (
        <>
          <section className="mobile-card mobile-card-spaced">
            <span className="section-label">
              {isDepositExpired ? "Address expired" : "Send this crypto"}
            </span>
            <div className="amount-emphasis">
              <strong>
                {formatAsset(transaction.deposit.amount, transaction.deposit.currency)}
              </strong>
              <span>{transaction.deposit.network} network</span>
            </div>
            <div className="copy-card">
              <span className="section-label">Wallet address</span>
              <strong className="mono">{transaction.deposit.address}</strong>
              <button
                className="button button-primary button-block"
                type="button"
                onClick={() => {
                  void handleCopyAddress();
                }}
              >
                Copy wallet address
              </button>
            </div>
            <p className="muted">
              {isDepositExpired
                ? "This payment address has expired. A new transaction will generate a fresh address."
                : `Send exactly ${formatAsset(transaction.deposit.amount, transaction.deposit.currency)} on ${transaction.deposit.network} network to this address. Funds sent on other networks will be lost.`}
            </p>
            {isAwaitingFundingPayment && transaction.deposit.expiresAt ? (
              depositExpirySeconds === 0 ? (
                <p className="error-text">
                  This wallet address expired{" "}
                  {new Date(transaction.deposit.expiresAt).toLocaleString()}.
                </p>
              ) : (
                <div className="inline-note countdown-note">
                  <div className="summary-row">
                    <span>Address expiry</span>
                    <strong>{formatCountdown(depositExpirySeconds)}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Expires at</span>
                    <strong>
                      {new Date(transaction.deposit.expiresAt).toLocaleString()}
                    </strong>
                  </div>
                </div>
              )
            ) : null}
          </section>

          <section className="mobile-card mobile-card-spaced">
            <div className="summary-row">
              <span>Status</span>
              <span className={`status-badge ${isDepositExpired ? "status-expired" : `status-${transaction.status}`}`}>
                {isDepositExpired ? statusLabel("expired") : statusLabel(transaction.status)}
              </span>
            </div>
            <TransactionTimeline tx={transaction} />
            {isAwaitingFundingPayment && activeFundingQuote ? (
              <div className="inline-note countdown-note">
                <div className="summary-row">
                    <span>Rate refresh</span>
                  <strong>
                    {isRefreshingFundingQuote || fundingRefreshSeconds === 0
                      ? "Refreshing..."
                      : formatCountdown(fundingRefreshSeconds)}
                  </strong>
                </div>
              </div>
            ) : null}
            {isAwaitingFundingPayment ? (
              <p className="muted">
                The crypto amount is locked. The recipient payout stays estimated
                until your transfer is received and the swap is executed.
              </p>
            ) : null}
            <div className="mobile-summary-list">
              <div className="summary-row">
                <span>Recipient</span>
                <strong>{transaction.bankDestination.accountName}</strong>
              </div>
              <div className="summary-row">
                <span>
                  {isAwaitingFundingPayment
                    ? "Estimated naira payout"
                    : "Naira payout"}
                </span>
                <strong>{formatNaira(activeFundingQuote?.netAmount)}</strong>
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

function BankPicker({
  banks,
  selectedBank,
  loading,
  onSelect,
}: {
  banks: Bank[];
  selectedBank: Bank | null;
  loading: boolean;
  onSelect: (bankCode: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredBanks = banks.filter((bank) =>
    bank.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="field-block" ref={containerRef}>
      <span>Bank</span>
      <button
        type="button"
        className="picker-button"
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selectedBank?.name ?? "Select bank"}</span>
        <span className="picker-chevron">{open ? "−" : "+"}</span>
      </button>

      {open ? (
        <div className="picker-popover">
          <input
            autoFocus
            type="search"
            value={search}
            placeholder="Search bank"
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="picker-options">
            {loading ? <p className="screen-message">Loading banks...</p> : null}
            {!loading && filteredBanks.length === 0 ? (
              <p className="screen-message">No bank found.</p>
            ) : null}
            {!loading
              ? filteredBanks.map((bank) => (
                  <button
                    key={bank.code}
                    type="button"
                    className={
                      selectedBank?.code === bank.code
                        ? "picker-option active"
                        : "picker-option"
                    }
                    onClick={() => {
                      onSelect(bank.code);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    {bank.name}
                  </button>
                ))
              : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
