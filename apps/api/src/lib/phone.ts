export function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/[\s\-\(\)]/g, "");

  const stripped = cleaned.replace(/\+/g, "");

  const deduped =
    stripped.startsWith("234") && stripped.slice(3).startsWith("234")
      ? stripped.slice(3)
      : stripped;

  if (deduped.startsWith("234") && deduped.length >= 13) {
    return deduped;
  }

  if (deduped.startsWith("0") && deduped.length === 11) {
    return `234${deduped.slice(1)}`;
  }

  if (deduped.length === 10 && /^\d{10}$/.test(deduped)) {
    return `234${deduped}`;
  }

  return deduped;
}
