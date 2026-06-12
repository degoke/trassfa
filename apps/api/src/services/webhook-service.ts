import type { SkyewalletWebhookEvent } from "../lib/domain.js";
import {
  buildWebhookDedupeKey,
  parseWebhookPayload,
  verifyWebhookSignature,
  type SkyewalletWebhookHeaders
} from "../lib/skyewallet-webhooks.js";
import { WebhookEventRepository } from "../repositories/webhook-event-repository.js";
import { TransactionService } from "./transaction-service.js";

export class WebhookService {
  constructor(
    private readonly webhooks: WebhookEventRepository,
    private readonly transactions: TransactionService,
    private readonly secret?: string
  ) {}

  async resetStaleProcessing() {
    const stale = await this.webhooks.resetStaleProcessing();
    if (stale.length > 0) {
      console.warn(`Reset ${stale.length} stale webhook events from 'processing' to 'failed'`);
    }
  }

  async receive(rawBody: string, headers: SkyewalletWebhookHeaders) {
    console.log("[webhook] WebhookService.receive: verifying signature");
    verifyWebhookSignature(rawBody, headers, this.secret);
    console.log("[webhook] WebhookService.receive: parsing payload");
    const payload = parseWebhookPayload(rawBody);

    if (headers.event && headers.event !== payload.event) {
      throw new Error("Webhook event header does not match payload event");
    }

    const dedupeKey = buildWebhookDedupeKey(payload);
    console.log("[webhook] WebhookService.receive: creating/getting pending", {
      event: payload.event,
      dedupeKey
    });
    return this.webhooks.createOrGetPending({
      dedupeKey,
      event: payload.event,
      payload
    });
  }

  async processPendingWebhook(id: number) {
    console.log("[webhook] processPendingWebhook: claiming", { id });
    const record = await this.webhooks.claimForProcessing(id);
    if (!record) {
      console.log("[webhook] processPendingWebhook: already claimed or not found", { id });
      return;
    }

    console.log("[webhook] processPendingWebhook: handling event", {
      event: record.payload.event,
      dedupeKey: record.dedupeKey
    });
    try {
      const result = await this.transactions.handleWebhookEvent(record.payload);
      console.log("[webhook] processPendingWebhook: handled", { result });
      await this.webhooks.markProcessed(
        record.id,
        result.status,
        result.status === "processed" ? result.matchedTransactionId : undefined
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Webhook processing failed";
      console.log("[webhook] processPendingWebhook: failed", { message });
      await this.webhooks.markFailed(record.id, message);
      throw error;
    }
  }
}
