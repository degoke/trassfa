import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { AppVariables } from "../lib/app-context.js";
import { bankResolutionSchema } from "./schemas.js";
import { BankService } from "../services/bank-service.js";
import { requireAuth } from "./middleware.js";

export function createBankRoutes(bankService: BankService) {
  const app = new Hono<{
    Variables: AppVariables;
  }>();

  app.use("*", requireAuth);

  app.get("/api/banks", async (c) => {
    const countryCode = (c.req.query("countryCode") ?? "NG").toUpperCase();
    const banks = await bankService.listBanks(countryCode);
    return c.json({ banks });
  });

  app.post("/api/banks/resolve", zValidator("json", bankResolutionSchema), async (c) => {
    const body = c.req.valid("json");
    const resolved = await bankService.resolveBankAccount(body);
    return c.json(resolved);
  });

  return app;
}
