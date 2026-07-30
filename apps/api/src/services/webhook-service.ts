import { logger } from "../lib/logger.js";
import {
  buildWebhookDedupeKey,
  parseWebhookPayload,
  verifyWebhookSignature,
  type SkyewalletWebhookHeaders,
} from "../lib/skyewallet-webhooks.js";
import { WebhookEventRepository } from "../repositories/webhook-event-repository.js";
import { TransactionService } from "./transaction-service.js";

export class WebhookService {
  constructor(
    private readonly webhooks: WebhookEventRepository,
    private readonly transactions: TransactionService,
    private readonly secret?: string,
  ) {}

  async resetStaleProcessing() {
    const stale = await this.webhooks.resetStaleProcessing();
    if (stale.length > 0) {
      logger.warn(`Reset ${stale.length} stale webhook events from 'processing' to 'failed'`);
    }
  }

  async receive(rawBody: string, headers: SkyewalletWebhookHeaders) {
    verifyWebhookSignature(rawBody, headers, this.secret);
    const payload = parseWebhookPayload(rawBody);

    if (headers.event && headers.event !== payload.event) {
      throw new Error("Webhook event header does not match payload event");
    }

    const dedupeKey = buildWebhookDedupeKey(payload);
    logger.debug("[webhook] WebhookService.receive", {
      event: payload.event,
      dedupeKey,
    });
    return this.webhooks.createOrGetPending({
      dedupeKey,
      event: payload.event,
      payload,
    });
  }

  async processPendingWebhook(id: number) {
    const record = await this.webhooks.claimForProcessing(id);
    if (!record) {
      logger.debug("[webhook] processPendingWebhook: already claimed or not found", { id });
      return;
    }

    logger.debug("[webhook] processPendingWebhook: handling event", {
      id,
      event: record.payload.event,
      dedupeKey: record.dedupeKey,
    });
    try {
      const result = await this.transactions.handleWebhookEvent(record.payload);
      logger.debug("[webhook] processPendingWebhook: handled", { id, result });
      await this.webhooks.markProcessed(
        record.id,
        result.status,
        result.status === "processed" ? result.matchedTransactionId : undefined,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Webhook processing failed";
      logger.error("[webhook] processPendingWebhook: failed", { id, message });
      await this.webhooks.markFailed(record.id, message);
      throw error;
    }
  }
}
