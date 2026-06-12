import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { AppVariables } from "../lib/app-context.js";
import { QuoteService } from "../services/quote-service.js";
import { requireAuth } from "./middleware.js";
import { bankToCryptoQuoteSchema, cryptoToBankQuoteSchema } from "./schemas.js";

export function createQuoteRoutes(quoteService: QuoteService) {
  const app = new Hono<{
    Variables: AppVariables;
  }>();

  app.use("*", requireAuth);

  app.post("/api/quotes/crypto-to-bank", zValidator("json", cryptoToBankQuoteSchema), async (c) => {
    const body = c.req.valid("json");
    const quote = await quoteService.quoteCryptoToBank(body);
    return c.json({ quote });
  });

  app.post("/api/quotes/bank-to-crypto", zValidator("json", bankToCryptoQuoteSchema), async (c) => {
    const body = c.req.valid("json");
    const quote = await quoteService.quoteBankToCrypto(body);
    return c.json({ quote });
  });

  return app;
}
