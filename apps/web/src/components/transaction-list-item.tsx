import { Link } from "@tanstack/react-router";
import type { Transaction } from "../lib/api";
import {
  formatAsset,
  formatNaira,
  getTransactionDirectionLabel,
  statusLabel,
} from "../lib/transaction-ui";

export function TransactionListItem({ tx }: { tx: Transaction }) {
  const isSend = tx.direction === "crypto_to_bank";
  const isEstimate = tx.status === "awaiting_payment";
  const expiresAt =
    tx.direction === "crypto_to_bank"
      ? tx.deposit.expiresAt
      : "virtualAccount" in tx
        ? tx.virtualAccount.expiresAt
        : undefined;
  const isExpired =
    tx.status === "awaiting_payment" &&
    expiresAt != null &&
    new Date(expiresAt).getTime() <= Date.now();
  const displayStatus = isExpired ? "expired" : tx.status;
  const primaryValue = isSend
    ? formatAsset(tx.deposit.amount, tx.deposit.currency)
    : formatNaira(tx.quote.fromAmount);
  const secondaryValue = isSend
    ? formatNaira(tx.quote.netAmount)
    : formatAsset(tx.quote.netAmount, tx.payoutDestination.currency);

  return (
    <Link to="/app/transactions/$id" params={{ id: tx.id }} className="transaction-card">
      <div className="transaction-card-row">
        <span className="transaction-card-kind">{getTransactionDirectionLabel(tx)}</span>
        <span className={`status-badge status-${displayStatus}`}>{statusLabel(displayStatus)}</span>
      </div>
      <div className="transaction-card-values">
        <strong>{primaryValue}</strong>
        <span>{isEstimate && !isExpired ? `Est. ${secondaryValue}` : secondaryValue}</span>
      </div>
      <div className="transaction-card-row transaction-card-meta">
        <span>{new Date(tx.createdAt).toLocaleDateString()}</span>
        <span>{tx.id.slice(0, 8)}</span>
      </div>
    </Link>
  );
}
