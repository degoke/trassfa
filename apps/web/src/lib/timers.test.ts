import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatCountdown,
  getSecondsRemaining,
  useRefreshCountdown,
  useSecondsRemaining,
} from "./timers";
import { renderHook, act } from "@testing-library/react";

describe("formatCountdown", () => {
  it("formats seconds as mm:ss", () => {
    expect(formatCountdown(125)).toBe("02:05");
    expect(formatCountdown(0)).toBe("00:00");
  });

  it("returns a placeholder for null values", () => {
    expect(formatCountdown(null)).toBe("--:--");
  });
});

describe("getSecondsRemaining", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-01T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns remaining seconds until a target time", () => {
    expect(getSecondsRemaining("2024-06-01T12:01:30.000Z")).toBe(90);
  });

  it("never returns negative values", () => {
    expect(getSecondsRemaining("2024-06-01T11:00:00.000Z")).toBe(0);
  });

  it("returns null for invalid targets", () => {
    expect(getSecondsRemaining("invalid-date")).toBeNull();
    expect(getSecondsRemaining(null)).toBeNull();
  });
});

describe("useSecondsRemaining", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-01T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("updates the countdown every second", () => {
    const { result } = renderHook(() => useSecondsRemaining("2024-06-01T12:00:05.000Z"));

    expect(result.current).toBe(5);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current).toBe(4);
  });
});

describe("useRefreshCountdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-01T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls onRefresh when the countdown reaches zero", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);

    renderHook(() =>
      useRefreshCountdown({
        enabled: true,
        target: "2024-06-01T12:00:02.000Z",
        onRefresh,
      }),
    );

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
