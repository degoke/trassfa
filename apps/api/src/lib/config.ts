import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const envSchema = z.object({
  PORT: z.coerce.number().default(8787),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  WEB_APP_URL: z.string().url().default("http://localhost:5173"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:8787"),
  BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required"),
  SKYEWALLET_API_KEY: z.string().min(1, "SKYEWALLET_API_KEY is required"),
  SKYEWALLET_BASE_URL: z.string().url().default("https://test--pay.skyewallet.com"),
  SKYEWALLET_WEBHOOK_SECRET: z.string().optional(),
  LINKPAY_PUBLIC_URL: z.string().url().default("http://localhost:8787")
});

export const env = envSchema.parse(process.env);
