import type { Transaction } from "../lib/api";
import { getTransactionProgress } from "../lib/transaction-ui";

export function TransactionTimeline({ tx }: { tx: Transaction }) {
  const items = getTransactionProgress(tx);

  return (
    <div className="timeline-list">
      {items.map((item, index) => (
        <div key={item.key} className="timeline-item">
          <div className={`timeline-dot timeline-dot-${item.state}`}>
            {item.state === "done" ? "✓" : index + 1}
          </div>
          <div className="timeline-copy">
            <strong>{item.label}</strong>
            <span>{item.description}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
