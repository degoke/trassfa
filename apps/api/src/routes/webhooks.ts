import { Hono } from "hono";
import type { AppVariables } from "../lib/app-context.js";
import { WebhookService } from "../services/webhook-service.js";

export function createWebhookRoutes(webhookService: WebhookService) {
  const app = new Hono<{
    Variables: AppVariables;
  }>();

  app.post("/webhooks/skyewallet", async (c) => {
    const rawBody = await c.req.text();
    const headers: Record<string, string> = {};
    c.req.raw.headers.forEach((value, key) => {
      headers[key] = value;
    });
    console.log("[webhook] received", {
      url: c.req.url,
      method: c.req.method,
      headers,
      body: rawBody
    });
    let created: boolean;
    let record: Awaited<ReturnType<WebhookService["receive"]>>["record"];

    try {
      const received = await webhookService.receive(rawBody, {
        signature: c.req.header("x-skyewallet-signature"),
        timestamp: c.req.header("x-skyewallet-timestamp"),
        event: c.req.header("x-skyewallet-event")
      });
      created = received.created;
      record = received.record;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid webhook request";

      if (message.toLowerCase().includes("signature")) {
        console.log("[webhook] response", { status: 401, body: "Invalid signature" });
        return c.text("Invalid signature", 401);
      }

      if (message.toLowerCase().includes("payload") || message.toLowerCase().includes("header")) {
        console.log("[webhook] response", { status: 400, body: "Invalid payload" });
        return c.text("Invalid payload", 400);
      }

      throw error;
    }

    if (created || record.status === "failed") {
      setImmediate(() => {
        void webhookService.processPendingWebhook(record.id).catch((error) => {
          console.error("Skyewallet webhook processing failed", error);
        });
      });
    }

    console.log("[webhook] response", { status: 200, body: "ok", created, recordStatus: record.status });
    return c.text("ok", 200);
  });

  return app;
}
