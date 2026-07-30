import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useFlowFeedback } from "./use-flow-feedback";

describe("useFlowFeedback", () => {
  it("tracks error and feedback messages", () => {
    const { result } = renderHook(() => useFlowFeedback());

    act(() => {
      result.current.setError("Invalid amount");
      result.current.setFeedback("Quote updated");
    });

    expect(result.current.error).toBe("Invalid amount");
    expect(result.current.feedback).toBe("Quote updated");
  });
});
