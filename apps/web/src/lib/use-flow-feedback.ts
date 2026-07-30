import { useState } from "react";

export function useFlowFeedback() {
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  return {
    error,
    setError,
    feedback,
    setFeedback,
  };
}
