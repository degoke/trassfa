import { useEffect, useRef, useState } from "react";

export const QUOTE_REFRESH_INTERVAL_MS = 60_000;

export function formatCountdown(seconds: number | null | undefined) {
  if (seconds == null) {
    return "--:--";
  }

  const safeSeconds = Math.max(seconds, 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function getSecondsRemaining(target?: string | null) {
  if (!target) {
    return null;
  }

  const targetTime = new Date(target).getTime();
  if (Number.isNaN(targetTime)) {
    return null;
  }

  return Math.max(Math.ceil((targetTime - Date.now()) / 1000), 0);
}

export function useSecondsRemaining(target?: string | null) {
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(() =>
    getSecondsRemaining(target),
  );

  useEffect(() => {
    setSecondsRemaining(getSecondsRemaining(target));

    if (!target) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setSecondsRemaining(getSecondsRemaining(target));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [target]);

  return secondsRemaining;
}

export function useRefreshCountdown({
  enabled,
  target,
  intervalMs = QUOTE_REFRESH_INTERVAL_MS,
  onRefresh,
}: {
  enabled: boolean;
  target?: string | null;
  intervalMs?: number;
  onRefresh: () => Promise<unknown> | void;
}) {
  const intervalSeconds = Math.max(Math.ceil(intervalMs / 1000), 1);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState<number | null>(() =>
    target ? getSecondsRemaining(target) : intervalSeconds,
  );
  const refreshRef = useRef(onRefresh);
  const inFlightRef = useRef(false);

  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    setSecondsUntilRefresh(target ? getSecondsRemaining(target) : intervalSeconds);

    if (!enabled) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setSecondsUntilRefresh((current) => {
        const nextSeconds = target ? getSecondsRemaining(target) : current ?? intervalSeconds;

        if (nextSeconds !== null && nextSeconds <= 0) {
          if (!inFlightRef.current) {
            inFlightRef.current = true;
            void Promise.resolve(refreshRef.current()).finally(() => {
              inFlightRef.current = false;
            });
          }

          return target ? 0 : intervalSeconds;
        }

        if (target) {
          return nextSeconds;
        }

        return Math.max((current ?? intervalSeconds) - 1, 0);
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [enabled, intervalSeconds, target]);

  return secondsUntilRefresh;
}
