import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { SkyewalletWebhookEvent } from "./domain.js";
import { isProduction } from "./config.js";
import { logger } from "./logger.js";
import { WEBHOOK_TIMESTAMP_TOLERANCE_MS } from "./security-constants.js";

export type SkyewalletWebhookHeaders = {
  signature?: string;
  timestamp?: string;
  event?: string;
};

const UNIQUE_REFERENCE_KEYS = new Set([
  "pay_reference",
  "transaction_id",
  "transfer_id",
  "swap_id",
  "withdrawal_id",
  "account_id",
  "account_number",
  "address",
  "tx_hash",
  "external_reference",
  "payment_account",
  "payment_address",
  "virtual_account",
]);

export function parseWebhookPayload(rawBody: string) {
  const parsed = JSON.parse(rawBody) as SkyewalletWebhookEvent;

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid webhook payload");
  }

  if (
    typeof parsed.event !== "string" ||
    (typeof parsed.timestamp !== "string" && typeof parsed.timestamp !== "number")
  ) {
    throw new Error("Webhook payload is missing required envelope fields");
  }

  if (!parsed.data || typeof parsed.data !== "object" || Array.isArray(parsed.data)) {
    throw new Error("Webhook payload data must be an object");
  }

  logger.debug("[webhook] parseWebhookPayload", {
    event: parsed.event,
    timestamp: parsed.timestamp,
    dataKeys: Object.keys(parsed.data),
  });
  return parsed;
}

export function verifyWebhookSignature(
  rawBody: string,
  headers: SkyewalletWebhookHeaders,
  secret?: string,
) {
  if (!secret) {
    if (isProduction) {
      throw new Error("Invalid Skyewallet webhook signature");
    }

    logger.debug(
      "[webhook] verifyWebhookSignature: no secret configured, skipping verification in development",
    );
    return;
  }

  if (!headers.signature || !headers.timestamp) {
    throw new Error("Missing Skyewallet webhook signature headers");
  }

  validateWebhookTimestamp(headers.timestamp);

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");

  try {
    const incoming = Buffer.from(headers.signature, "hex");
    const expectedBuffer = Buffer.from(expected, "hex");

    if (!timingSafeEqual(incoming, expectedBuffer)) {
      throw new Error("Invalid Skyewallet webhook signature");
    }
  } catch {
    throw new Error("Invalid Skyewallet webhook signature");
  }
}

export function validateWebhookTimestamp(timestamp: string) {
  const parsed = Number(timestamp);
  if (!Number.isFinite(parsed)) {
    throw new Error("Invalid webhook timestamp header");
  }

  const timestampMs = parsed < 1_000_000_000_000 ? parsed * 1000 : parsed;
  const delta = Math.abs(Date.now() - timestampMs);

  if (delta > WEBHOOK_TIMESTAMP_TOLERANCE_MS) {
    throw new Error("Webhook timestamp is outside the allowed tolerance window");
  }
}

export function getWebhookDataValue(event: SkyewalletWebhookEvent, key: string) {
  for (const candidate of getWebhookDataKeys(key)) {
    const value = event.data[candidate];
    if (value !== undefined && value !== null) {
      return value;
    }
  }

  return undefined;
}

export function buildWebhookDedupeKey(event: SkyewalletWebhookEvent) {
  const preferredKeys = [
    "pay_reference",
    "transaction_id",
    "transfer_id",
    "swap_id",
    "withdrawal_id",
    "account_id",
  ];

  for (const key of preferredKeys) {
    const value = getWebhookDataValue(event, key);
    if (typeof value === "string" && value.length > 0) {
      return `${event.event}:${key}:${value}`;
    }
  }

  const payloadHash = createHash("sha256").update(JSON.stringify(event)).digest("hex");

  return `${event.event}:hash:${payloadHash}`;
}

export function extractReferenceValues(event: SkyewalletWebhookEvent) {
  const values = new Set<string>();
  const orderedKeys = getReferenceLookupKeys(event.event);

  for (const key of orderedKeys) {
    const value = getWebhookDataValue(event, key);
    if (typeof value === "string" && value.length > 0) {
      values.add(value);
    }
  }

  return [...values];
}

function getWebhookDataKeys(key: string) {
  return [key, snakeToCamel(key)];
}

function getReferenceLookupKeys(eventName: string) {
  switch (eventName) {
    case "payment.received":
    case "account.expired":
      return [
        "pay_reference",
        "account_id",
        "account_number",
        "address",
        "tx_hash",
        "transaction_id",
      ];
    case "swap.completed":
    case "swap.failed":
      return ["pay_reference", "swap_id", "transaction_id"];
    case "payout.completed":
    case "payout.failed":
    case "transfer.completed":
    case "transfer.failed":
      return ["pay_reference", "transfer_id", "transaction_id", "external_reference"];
    default:
      return [
        "pay_reference",
        "transaction_id",
        "transfer_id",
        "swap_id",
        "withdrawal_id",
        "account_id",
        "account_number",
        "address",
        "tx_hash",
        "external_reference",
      ];
  }
}

export function isUniqueReferenceKey(key: string) {
  return UNIQUE_REFERENCE_KEYS.has(key);
}

function snakeToCamel(value: string) {
  return value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}
