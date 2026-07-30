import { afterEach, describe, expect, it, vi } from "vitest";

describe("getPublicErrorMessage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("returns the original message outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { getPublicErrorMessage } = await import("./errors.js");

    expect(getPublicErrorMessage(new Error("database unavailable"))).toBe("database unavailable");
  });

  it("masks errors in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BETTER_AUTH_SECRET", "prod-better-auth-key-value-32chars!!");
    vi.stubEnv("SKYEWALLET_API_KEY", "prod-skyewallet-api-key-value-32!!");
    vi.stubEnv("ENCRYPTION_KEY", "production-encryption-key-32-chars-min");
    vi.stubEnv("ADMIN_API_TOKEN", "production-admin-api-token-32-chars");
    vi.stubEnv("SKYEWALLET_WEBHOOK_SECRET", "production-webhook-key-value-32!!");
    const { getPublicErrorMessage } = await import("./errors.js");

    expect(getPublicErrorMessage(new Error("database unavailable"))).toBe("Internal server error");
  });
});
