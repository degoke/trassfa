import { useEffect, useState } from "react";
import { AuthRequired } from "../components/auth-required";
import { TransactionListItem } from "../components/transaction-list-item";
import { listTransactions, type Transaction } from "../lib/api";
import { authClient } from "../lib/auth-client";

export function TransactionsPage() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user) {
      setLoading(false);
      return;
    }

    listTransactions()
      .then((response) => setTransactions(response.transactions))
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [session?.user]);

  if (sessionPending) {
    return <p className="screen-message">Loading...</p>;
  }

  if (!session?.user) {
    return (
      <AuthRequired title="History" message="Sign in to see transaction history and receipts." />
    );
  }

  return (
    <div className="mobile-screen">
      <div className="screen-header">
        <span className="section-label">History</span>
        <strong>Transactions</strong>
      </div>

      {loading ? <p className="screen-message">Loading transactions...</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      {!loading && !error && transactions.length === 0 ? (
        <div className="mobile-card mobile-card-spaced">
          <strong>No transactions yet</strong>
          <span className="muted">Your send and receive flows will show here.</span>
        </div>
      ) : null}
      {!loading && !error
        ? transactions.map((tx) => <TransactionListItem key={tx.id} tx={tx} />)
        : null}
    </div>
  );
}
