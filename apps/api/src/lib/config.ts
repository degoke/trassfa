import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const WEAK_SECRET_PATTERNS = ["replace_me", "changeme", "secret", "test"];

function assertProductionSecret(name: string, value: string) {
  const normalized = value.toLowerCase();
  if (WEAK_SECRET_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    throw new Error(`${name} must be replaced with a strong secret in production`);
  }
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().default(8787),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    WEB_APP_URL: z.string().url().default("http://localhost:5173"),
    BETTER_AUTH_URL: z.string().url().default("http://localhost:8787"),
    BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required"),
    SKYEWALLET_API_KEY: z.string().min(1, "SKYEWALLET_API_KEY is required"),
    SKYEWALLET_BASE_URL: z.string().url().default("https://test--pay.skyewallet.com"),
    SKYEWALLET_WEBHOOK_SECRET: z.string().optional(),
    ENCRYPTION_KEY: z.string().optional(),
    ADMIN_EMAILS: z
      .string()
      .optional()
      .transform((value) =>
        value
          ? value
              .split(",")
              .map((email) => email.trim().toLowerCase())
              .filter(Boolean)
          : [],
      ),
    ADMIN_API_TOKEN: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === "production") {
      if (!value.SKYEWALLET_WEBHOOK_SECRET) {
        ctx.addIssue({
          code: "custom",
          path: ["SKYEWALLET_WEBHOOK_SECRET"],
          message: "SKYEWALLET_WEBHOOK_SECRET is required in production",
        });
      }

      if (!value.ENCRYPTION_KEY || value.ENCRYPTION_KEY.length < 32) {
        ctx.addIssue({
          code: "custom",
          path: ["ENCRYPTION_KEY"],
          message: "ENCRYPTION_KEY must be at least 32 characters in production",
        });
      }

      if (!value.ADMIN_API_TOKEN || value.ADMIN_API_TOKEN.length < 32) {
        ctx.addIssue({
          code: "custom",
          path: ["ADMIN_API_TOKEN"],
          message: "ADMIN_API_TOKEN must be at least 32 characters in production",
        });
      }

      assertProductionSecret("BETTER_AUTH_SECRET", value.BETTER_AUTH_SECRET);
      assertProductionSecret("SKYEWALLET_API_KEY", value.SKYEWALLET_API_KEY);

      if (value.SKYEWALLET_WEBHOOK_SECRET) {
        assertProductionSecret("SKYEWALLET_WEBHOOK_SECRET", value.SKYEWALLET_WEBHOOK_SECRET);
      }
    }
  });

export const env = envSchema.parse(process.env);
export const isProduction = env.NODE_ENV === "production";
