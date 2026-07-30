import type { Transaction } from "./api";

export const STATUS_LABELS: Record<string, string> = {
  awaiting_payment: "Awaiting payment",
  payment_received: "Payment received",
  swapping: "Payment received",
  payout_pending: "Sending payout",
  completed: "Payout completed",
  failed: "Payout failed",
  expired: "Address expired",
};

export type ProgressItem = {
  key: string;
  label: string;
  description: string;
  state: "done" | "active" | "pending";
};

export function statusLabel(status: string) {
  return STATUS_LABELS[status] ?? status;
}

export function isTerminalStatus(status: string) {
  return status === "completed" || status === "failed" || status === "expired";
}

export function formatNaira(amount: number | null | undefined) {
  if (amount == null || Number.isNaN(amount)) {
    return "--";
  }

  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatAsset(amount: number | string | null | undefined, currency?: string) {
  if (amount == null || amount === "") {
    return currency ? `-- ${currency}` : "--";
  }

  const numericAmount = typeof amount === "string" ? Number.parseFloat(amount) : amount;
  const formattedAmount = Number.isFinite(numericAmount)
    ? new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 6,
      }).format(numericAmount)
    : String(amount);

  return currency ? `${formattedAmount} ${currency}` : formattedAmount;
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

export function getTransactionDirectionLabel(tx: Transaction) {
  return tx.direction === "crypto_to_bank" ? "Send" : "Receive";
}

export function getTransactionProgress(tx: Transaction): ProgressItem[] {
  const isExpired = tx.status === "expired";
  const isFailed = tx.status === "failed";
  const directionNoun = tx.direction === "crypto_to_bank" ? "wallet transfer" : "bank transfer";
  const payoutNoun = tx.direction === "crypto_to_bank" ? "bank payout" : "wallet payout";
  const awaitingDescription =
    tx.direction === "crypto_to_bank"
      ? "Waiting for the wallet transfer to land."
      : "Waiting for NGN to arrive in the generated account.";

  const currentStepKey =
    tx.status === "awaiting_payment"
      ? "awaiting_payment"
      : tx.status === "payment_received" || tx.status === "swapping"
        ? "payment_received"
        : tx.status === "payout_pending" || tx.status === "failed"
          ? "payout_pending"
          : tx.status === "completed"
            ? "completed"
            : tx.status === "expired"
              ? "expired"
              : "awaiting_payment";

  const items: ProgressItem[] = [
    {
      key: "awaiting_payment",
      label: "Awaiting payment",
      description: awaitingDescription,
      state: getProgressState("awaiting_payment", currentStepKey, isExpired),
    },
    {
      key: "payment_received",
      label: "Payment received",
      description: `The ${directionNoun} has been confirmed.`,
      state: getProgressState("payment_received", currentStepKey, isExpired),
    },
    {
      key: "payout_pending",
      label: "Sending payout",
      description:
        tx.status === "failed"
          ? `The ${payoutNoun} could not be completed.`
          : `The ${payoutNoun} is being sent to the recipient.`,
      state: getProgressState("payout_pending", currentStepKey, isExpired),
    },
    {
      key: "completed",
      label: "Payout completed",
      description: `The ${payoutNoun} has been completed.`,
      state: getProgressState("completed", currentStepKey, isExpired),
    },
  ];

  if (isExpired) {
    items.push({
      key: "expired",
      label: "Address expired",
      description: "The payment account expired before funds were received.",
      state: "active",
    });
  }

  if (isFailed) {
    const payoutPendingItem = items[2]!;
    items[2] = {
      key: payoutPendingItem.key,
      label: payoutPendingItem.label,
      description: payoutPendingItem.description,
      state: "active",
    };
  }

  return items;
}

function getProgressState(
  stepKey: "awaiting_payment" | "payment_received" | "payout_pending" | "completed",
  currentStepKey: string,
  isExpired: boolean,
): ProgressItem["state"] {
  if (isExpired) {
    return stepKey === "awaiting_payment" ? "done" : "pending";
  }

  const order = ["awaiting_payment", "payment_received", "payout_pending", "completed"];
  const stepIndex = order.indexOf(stepKey);
  const currentIndex = order.indexOf(currentStepKey);

  if (currentStepKey === "completed" && stepKey === "completed") {
    return "done";
  }

  if (stepIndex < currentIndex) {
    return "done";
  }

  if (stepIndex === currentIndex) {
    return "active";
  }

  return "pending";
}

export function buildReceiptShareText(tx: Transaction) {
  const isEstimate = tx.status === "awaiting_payment";
  const lines: string[] = [];

  // Header
  lines.push("═══ RECEIPT ═══");
  lines.push("");

  // Amount
  const payoutLabel = isEstimate ? "Estimated settlement" : "Amount settled";
  if (tx.direction === "crypto_to_bank") {
    lines.push(`${formatNaira(tx.quote.netAmount)} — ${payoutLabel}`);
  } else {
    lines.push(`${formatAsset(tx.quote.netAmount, tx.quote.toCurrency)} — ${payoutLabel}`);
  }
  lines.push("");

  // Reference
  lines.push("── Reference ──");
  lines.push(`ID: ${tx.id}`);
  lines.push(`Type: ${getTransactionDirectionLabel(tx)}`);
  lines.push(`Date: ${formatDateTime(tx.createdAt)}`);
  lines.push(`Status: ${statusLabel(tx.status)}`);
  lines.push("");

  // Details
  lines.push("── Details ──");
  if (tx.direction === "crypto_to_bank") {
    lines.push(`You sent: ${formatAsset(tx.deposit.amount, tx.deposit.currency)}`);
    lines.push(`Network: ${tx.deposit.network}`);
    lines.push(`Recipient: ${tx.bankDestination.accountName}`);
    lines.push(`Account: ${tx.bankDestination.accountNumber}`);
  } else {
    lines.push(`You paid: ${formatNaira(tx.quote.fromAmount)}`);
    lines.push(`You received: ${formatAsset(tx.quote.netAmount, tx.payoutDestination.currency)}`);
    lines.push(`Network: ${tx.payoutDestination.network}`);
    lines.push(`Wallet: ${tx.payoutDestination.address}`);
  }
  if (tx.payout) {
    lines.push(`Payout ref: ${tx.payout.id}`);
  }

  return lines.join("\n");
}
