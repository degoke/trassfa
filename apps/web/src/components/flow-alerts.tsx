export function FlowAlerts({
  error,
  feedback,
}: {
  error?: string | null;
  feedback?: string | null;
}) {
  return (
    <>
      {error ? <p className="error-text">{error}</p> : null}
      {feedback ? <p className="success-text">{feedback}</p> : null}
    </>
  );
}
