import { formatCountdown } from "../lib/timers";

export function QuoteRefreshBanner({
  isRefreshing,
  refreshSeconds,
}: {
  isRefreshing: boolean;
  refreshSeconds: number | null;
}) {
  return (
    <div className="inline-note countdown-note">
      <div className="summary-row">
        <span>Rate refresh</span>
        <strong>
          {isRefreshing || refreshSeconds === 0 || refreshSeconds === null
            ? "Refreshing..."
            : formatCountdown(refreshSeconds)}
        </strong>
      </div>
    </div>
  );
}
