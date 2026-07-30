import { Hono } from "hono";
import type { AppVariables } from "../lib/app-context.js";
import { logger } from "../lib/logger.js";
import { WEBHOOK_MAX_BODY_BYTES } from "../lib/security-constants.js";
import { WebhookService } from "../services/webhook-service.js";

export function createWebhookRoutes(webhookService: WebhookService) {
  const app = new Hono<{
    Variables: AppVariables;
  }>();

  app.post("/webhooks/skyewallet", async (c) => {
    const contentLength = Number(c.req.header("content-length") ?? "0");
    if (contentLength > WEBHOOK_MAX_BODY_BYTES) {
      return c.text("Payload too large", 413);
    }

    const rawBody = await c.req.text();
    if (rawBody.length > WEBHOOK_MAX_BODY_BYTES) {
      return c.text("Payload too large", 413);
    }

    logger.debug("[webhook] received", {
      event: c.req.header("x-skyewallet-event"),
      bodyLength: rawBody.length,
    });
    let created: boolean;
    let record: Awaited<ReturnType<WebhookService["receive"]>>["record"];

    try {
      const received = await webhookService.receive(rawBody, {
        signature: c.req.header("x-skyewallet-signature"),
        timestamp: c.req.header("x-skyewallet-timestamp"),
        event: c.req.header("x-skyewallet-event"),
      });
      created = received.created;
      record = received.record;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid webhook request";

      if (message.toLowerCase().includes("signature")) {
        return c.text("Invalid signature", 401);
      }

      if (
        message.toLowerCase().includes("payload") ||
        message.toLowerCase().includes("header") ||
        message.toLowerCase().includes("timestamp")
      ) {
        return c.text("Invalid payload", 400);
      }

      throw error;
    }

    if (created || record.status === "failed") {
      setImmediate(() => {
        void webhookService.processPendingWebhook(record.id).catch((error) => {
          logger.error("Skyewallet webhook processing failed", error);
        });
      });
    }

    logger.debug("[webhook] response", { status: 200, created, recordStatus: record.status });
    return c.text("ok", 200);
  });

  return app;
}
