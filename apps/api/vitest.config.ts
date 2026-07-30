import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      BETTER_AUTH_SECRET: "test-secret-value-for-vitest-suite",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/linkpay",
      SKYEWALLET_API_KEY: "sk_test_replace_me",
      ENCRYPTION_KEY: "local-development-encryption-key-32",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "src/lib/phone.ts",
        "src/lib/money.ts",
        "src/lib/encryption.ts",
        "src/lib/errors.ts",
        "src/lib/ids.ts",
        "src/lib/kyc-response.ts",
        "src/lib/rate-limit.ts",
        "src/lib/skyewallet-webhooks.ts",
        "src/routes/schemas.ts",
        "src/routes/middleware.ts",
        "src/routes/health.ts",
        "src/services/quote-service.ts",
      ],
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 70,
        statements: 75,
      },
    },
  },
});
