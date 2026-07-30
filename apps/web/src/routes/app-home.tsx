import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AuthRequired } from "../components/auth-required";
import { TransactionListItem } from "../components/transaction-list-item";
import { listTransactions, type Transaction } from "../lib/api";
import { authClient } from "../lib/auth-client";

export function AppHomePage() {
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
    return <AuthRequired title="App access" message="Sign in to start a send or receive flow." />;
  }

  return (
    <div className="mobile-screen">
      <section className="hero-balance-card">
        <span className="section-label">trassfa app</span>
        <strong>Move between crypto and NGN without leaving the flow.</strong>
        <span className="hero-balance-meta">{session.user.email}</span>
      </section>

      <section className="action-grid">
        <Link to="/app/send" className="action-tile action-tile-primary">
          <span>Send</span>
          <strong>Crypto to bank</strong>
        </Link>
        <Link to="/app/receive" className="action-tile action-tile-secondary">
          <span>Receive</span>
          <strong>Bank to crypto</strong>
        </Link>
      </section>

      <section className="mobile-section">
        <div className="section-heading">
          <span className="section-label">Recent transactions</span>
          <Link to="/app/transactions" className="inline-link">
            View all
          </Link>
        </div>

        {loading ? <p className="screen-message">Loading transactions...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
        {!loading && !error && transactions.length === 0 ? (
          <div className="mobile-card mobile-card-spaced">
            <strong>No transactions yet</strong>
            <span className="muted">Start with send or receive.</span>
          </div>
        ) : null}
        {!loading && !error
          ? transactions.slice(0, 4).map((tx) => <TransactionListItem key={tx.id} tx={tx} />)
          : null}
      </section>
    </div>
  );
}
