import { useState } from "react";
import { useRefreshCountdown } from "./timers";

export function usePreviewQuoteRefresh({
  enabled,
  onRefresh,
}: {
  enabled: boolean;
  onRefresh: () => Promise<void>;
}) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshSeconds = useRefreshCountdown({
    enabled,
    onRefresh: async () => {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    },
  });

  return { isRefreshing, refreshSeconds };
}
