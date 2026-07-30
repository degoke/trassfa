import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { AppVariables } from "../lib/app-context.js";
import { TransactionService } from "../services/transaction-service.js";
import { bankToCryptoTransactionSchema, cryptoToBankTransactionSchema } from "./schemas.js";
import { requireAuth, requireAuthenticatedUser, requireVerifiedEmail } from "./middleware.js";

export function createTransactionRoutes(transactionService: TransactionService) {
  const app = new Hono<{
    Variables: AppVariables;
  }>();

  app.use("*", requireAuth, requireVerifiedEmail);

  app.get("/api/transactions", async (c) => {
    const user = requireAuthenticatedUser(c);
    const transactions = await transactionService.listTransactions(user.id);
    return c.json({ transactions });
  });

  app.get("/api/transactions/:id", async (c) => {
    const user = requireAuthenticatedUser(c);
    const transaction = await transactionService.getTransaction(c.req.param("id"), user.id);

    if (!transaction) {
      return c.json({ error: "Transaction not found" }, 404);
    }

    return c.json({ transaction });
  });

  app.post(
    "/api/transactions/crypto-to-bank",
    zValidator("json", cryptoToBankTransactionSchema),
    async (c) => {
      const user = requireAuthenticatedUser(c);
      const body = c.req.valid("json");
      const transaction = await transactionService.createCryptoToBankTransaction(user, body);
      return c.json({ transaction }, 201);
    },
  );

  app.post(
    "/api/transactions/bank-to-crypto",
    zValidator("json", bankToCryptoTransactionSchema),
    async (c) => {
      const user = requireAuthenticatedUser(c);
      const body = c.req.valid("json");
      const transaction = await transactionService.createBankToCryptoTransaction(user, body);
      return c.json({ transaction }, 201);
    },
  );

  return app;
}
