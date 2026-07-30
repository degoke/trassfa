import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import type { AppVariables } from "./lib/app-context.js";
import { auth } from "./lib/auth.js";
import { env } from "./lib/config.js";
import { getPublicErrorMessage } from "./lib/errors.js";
import { createRateLimiter, getClientIp } from "./lib/rate-limit.js";
import { SkyewalletClient } from "./lib/skyewallet.js";
import { TransactionRepository } from "./repositories/transaction-repository.js";
import { WebhookEventRepository } from "./repositories/webhook-event-repository.js";
import { createBankRoutes } from "./routes/banks.js";
import { createHealthRoutes } from "./routes/health.js";
import { createKycRoutes } from "./routes/kyc.js";
import { createProfileRoutes } from "./routes/profile.js";
import { createQuoteRoutes } from "./routes/quotes.js";
import { createTransactionRoutes } from "./routes/transactions.js";
import { createWalletRoutes } from "./routes/wallets.js";
import { createWebhookRoutes } from "./routes/webhooks.js";
import { BankService } from "./services/bank-service.js";
import { KycService } from "./services/kyc-service.js";
import { QuoteService } from "./services/quote-service.js";
import { TransactionService } from "./services/transaction-service.js";
import { WebhookService } from "./services/webhook-service.js";
import { sessionMiddleware } from "./routes/middleware.js";

const authRateLimit = createRateLimiter({
  keyPrefix: "auth",
  limit: 20,
  windowMs: 60_000,
  keyResolver: getClientIp,
});

const webhookRateLimit = createRateLimiter({
  keyPrefix: "webhook",
  limit: 120,
  windowMs: 60_000,
  keyResolver: getClientIp,
});

const apiRateLimit = createRateLimiter({
  keyPrefix: "api",
  limit: 180,
  windowMs: 60_000,
  keyResolver: (c) => c.get("user")?.id ?? getClientIp(c),
});

export function createApp() {
  const app = new Hono<{
    Variables: AppVariables;
  }>();
  const skyewallet = new SkyewalletClient({
    apiKey: env.SKYEWALLET_API_KEY,
    baseUrl: env.SKYEWALLET_BASE_URL,
  });
  const transactionRepository = new TransactionRepository();
  const webhookEventRepository = new WebhookEventRepository();
  const bankService = new BankService(skyewallet);
  const quoteService = new QuoteService(skyewallet);
  const kycService = new KycService();
  const transactionService = new TransactionService(
    transactionRepository,
    skyewallet,
    quoteService,
    bankService,
  );
  const webhookService = new WebhookService(
    webhookEventRepository,
    transactionService,
    env.SKYEWALLET_WEBHOOK_SECRET,
  );

  webhookService.resetStaleProcessing().catch(console.error);

  app.use("*", secureHeaders());

  app.use(
    "*",
    cors({
      origin: env.WEB_APP_URL,
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "x-skyewallet-signature",
        "x-skyewallet-event",
        "x-skyewallet-timestamp",
      ],
      allowMethods: ["GET", "POST", "OPTIONS"],
      exposeHeaders: ["Content-Length"],
      credentials: true,
    }),
  );

  app.use("/webhooks/*", webhookRateLimit);
  app.route("/", createWebhookRoutes(webhookService));

  app.use("/api/*", sessionMiddleware);
  app.use("/api/*", apiRateLimit);
  app.use("/api/auth/*", authRateLimit);
  app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

  app.route("/", createHealthRoutes());
  app.route("/", createBankRoutes(bankService));
  app.route("/", createQuoteRoutes(quoteService));
  app.route("/", createTransactionRoutes(transactionService));
  app.route("/", createWalletRoutes(skyewallet));
  app.route("/", createKycRoutes(kycService));
  app.route("/", createProfileRoutes(kycService, transactionRepository));

  app.onError((error, c) => {
    console.error(error);
    return c.json(
      {
        error: getPublicErrorMessage(error),
      },
      500,
    );
  });

  return app;
}
