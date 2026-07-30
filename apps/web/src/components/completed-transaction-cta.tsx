import { Link } from "@tanstack/react-router";
import type { Transaction } from "../lib/api";

export function CompletedTransactionCta({ transaction }: { transaction: Transaction }) {
  return (
    <section className="mobile-card mobile-card-spaced">
      <span className="section-label">Next</span>
      <strong>
        {transaction.status === "completed" ? "Payout completed." : "Transaction closed."}
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
  );
}
