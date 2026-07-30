import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { AppVariables } from "../lib/app-context.js";
import { bankResolutionSchema } from "./schemas.js";
import { createRateLimiter, getClientIp } from "../lib/rate-limit.js";
import { BankService } from "../services/bank-service.js";
import { requireAuth } from "./middleware.js";

const countryCodeSchema = z
  .string()
  .length(2)
  .regex(/^[A-Z]{2}$/);

const bankResolveRateLimit = createRateLimiter({
  keyPrefix: "bank-resolve",
  limit: 20,
  windowMs: 60_000,
  keyResolver: (c) => c.get("user")?.id ?? getClientIp(c),
});

export function createBankRoutes(bankService: BankService) {
  const app = new Hono<{
    Variables: AppVariables;
  }>();

  app.use("*", requireAuth);

  app.get("/api/banks", async (c) => {
    const countryCode = countryCodeSchema.parse((c.req.query("countryCode") ?? "NG").toUpperCase());
    const banks = await bankService.listBanks(countryCode);
    return c.json({ banks });
  });

  app.post(
    "/api/banks/resolve",
    bankResolveRateLimit,
    zValidator("json", bankResolutionSchema),
    async (c) => {
      const body = c.req.valid("json");
      const resolved = await bankService.resolveBankAccount(body);
      return c.json(resolved);
    },
  );

  return app;
}
