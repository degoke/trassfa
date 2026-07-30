import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "src/lib/transaction-ui.ts",
        "src/lib/timers.ts",
        "src/lib/api.ts",
        "src/lib/use-flow-feedback.ts",
        "src/lib/use-live-payment-quote.ts",
        "src/components/flow-alerts.tsx",
        "src/components/transaction-timeline.tsx",
        "src/components/quote-refresh-banner.tsx",
      ],
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 65,
        statements: 75,
      },
    },
  },
});
