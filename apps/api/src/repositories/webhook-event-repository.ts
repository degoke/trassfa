import { and, eq, inArray, lt, or } from "drizzle-orm";
import { db } from "../db/client.js";
import { webhookEventsTable, type WebhookEventRow } from "../db/schema.js";
import type {
  SkyewalletWebhookEvent,
  WebhookEventRecord,
  WebhookEventStatus
} from "../lib/domain.js";

const STALE_PROCESSING_TIMEOUT_MS = 5 * 60 * 1000;

export class WebhookEventRepository {
  async createOrGetPending(input: {
    dedupeKey: string;
    event: string;
    payload: SkyewalletWebhookEvent;
  }) {
    const inserted = await db
      .insert(webhookEventsTable)
      .values({
        dedupeKey: input.dedupeKey,
        event: input.event,
        payload: input.payload,
        status: "pending"
      })
      .onConflictDoNothing({
        target: webhookEventsTable.dedupeKey
      })
      .returning();

    const insertedRecord = inserted[0];
    if (insertedRecord) {
      console.log("[webhook] createOrGetPending: created new record", { id: insertedRecord.id, dedupeKey: input.dedupeKey });
      return {
        created: true,
        record: mapWebhookEvent(insertedRecord)
      };
    }

    console.log("[webhook] createOrGetPending: dedupe hit, fetching existing", { dedupeKey: input.dedupeKey });
    const existing = await db.query.webhookEventsTable.findFirst({
      where: eq(webhookEventsTable.dedupeKey, input.dedupeKey)
    });

    if (!existing) {
      throw new Error("Failed to load webhook event after dedupe conflict");
    }

    console.log("[webhook] createOrGetPending: returning existing", { id: existing.id, status: existing.status });
    return {
      created: false,
      record: mapWebhookEvent(existing)
    };
  }

  async claimForProcessing(id: number) {
    const staleThreshold = new Date(Date.now() - STALE_PROCESSING_TIMEOUT_MS);

    const updated = await db
      .update(webhookEventsTable)
      .set({
        status: "processing",
        updatedAt: new Date(),
        error: null
      })
      .where(
        and(
          eq(webhookEventsTable.id, id),
          or(
            inArray(webhookEventsTable.status, ["pending", "failed"]),
            and(
              eq(webhookEventsTable.status, "processing"),
              lt(webhookEventsTable.updatedAt, staleThreshold)
            )
          )
        )
      )
      .returning();

    return updated[0] ? mapWebhookEvent(updated[0]) : null;
  }

  async resetStaleProcessing() {
    const staleThreshold = new Date(Date.now() - STALE_PROCESSING_TIMEOUT_MS);

    const result = await db
      .update(webhookEventsTable)
      .set({
        status: "failed",
        error: "Stale processing reset — server restarted",
        updatedAt: new Date()
      })
      .where(
        and(
          eq(webhookEventsTable.status, "processing"),
          lt(webhookEventsTable.updatedAt, staleThreshold)
        )
      )
      .returning();

    return result.map(mapWebhookEvent);
  }

  async markProcessed(
    id: number,
    status: Extract<WebhookEventStatus, "processed" | "ignored">,
    matchedTransactionId?: string
  ) {
    await db
      .update(webhookEventsTable)
      .set({
        status,
        matchedTransactionId: matchedTransactionId ?? null,
        processedAt: new Date(),
        updatedAt: new Date(),
        error: null
      })
      .where(eq(webhookEventsTable.id, id));
  }

  async markFailed(id: number, error: string, matchedTransactionId?: string) {
    await db
      .update(webhookEventsTable)
      .set({
        status: "failed",
        matchedTransactionId: matchedTransactionId ?? null,
        error,
        updatedAt: new Date()
      })
      .where(eq(webhookEventsTable.id, id));
  }
}

function mapWebhookEvent(row: WebhookEventRow): WebhookEventRecord {
  return {
    id: row.id,
    dedupeKey: row.dedupeKey,
    event: row.event,
    payload: row.payload,
    status: row.status,
    matchedTransactionId: row.matchedTransactionId ?? undefined,
    error: row.error ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    processedAt: row.processedAt?.toISOString()
  };
}
