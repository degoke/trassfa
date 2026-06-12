import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { SkyewalletWebhookEvent } from "./domain.js";

export type SkyewalletWebhookHeaders = {
  signature?: string;
  timestamp?: string;
  event?: string;
};

export function parseWebhookPayload(rawBody: string) {
  console.log("[webhook] parseWebhookPayload", { rawBody });
  const parsed = JSON.parse(rawBody) as SkyewalletWebhookEvent;

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid webhook payload");
  }

  if (typeof parsed.event !== "string" || (typeof parsed.timestamp !== "string" && typeof parsed.timestamp !== "number")) {
    throw new Error("Webhook payload is missing required envelope fields");
  }

  if (!parsed.data || typeof parsed.data !== "object" || Array.isArray(parsed.data)) {
    throw new Error("Webhook payload data must be an object");
  }

  console.log("[webhook] parseWebhookPayload", { event: parsed.event, timestamp: parsed.timestamp, dataKeys: Object.keys(parsed.data) });
  return parsed;
}

export function verifyWebhookSignature(
  rawBody: string,
  headers: SkyewalletWebhookHeaders,
  secret?: string
) {
  console.log("[webhook] verifyWebhookSignature", {
    hasSecret: !!secret,
    hasSignature: !!headers.signature,
    hasTimestamp: !!headers.timestamp,
    signature: headers.signature?.slice(0, 20) + "...",
    timestamp: headers.timestamp,
    event: headers.event
  });

  if (!secret) {
    console.log("[webhook] verifyWebhookSignature: no secret configured, skipping verification");
    return;
  }

  if (!headers.signature || !headers.timestamp) {
    throw new Error("Missing Skyewallet webhook signature headers");
  }

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  console.log("[webhook] verifyWebhookSignature", {
    body: rawBody.slice(0, 50) + (rawBody.length > 50 ? "..." : ""),
    expectedSig: expected.slice(0, 20) + "...",
    incomingSig: headers.signature.slice(0, 20) + "..."
  });

  try {
    const incoming = Buffer.from(headers.signature, "hex");
    const expectedBuffer = Buffer.from(expected, "hex");

    if (!timingSafeEqual(incoming, expectedBuffer)) {
      throw new Error("Invalid Skyewallet webhook signature");
    }
    console.log("[webhook] verifyWebhookSignature: signature valid");
  } catch {
    console.log("[webhook] verifyWebhookSignature: signature invalid");
    throw new Error("Invalid Skyewallet webhook signature");
  }
}

export function normalizePayload(rawBody: string) {
  return JSON.stringify(JSON.parse(rawBody));
}

export function getWebhookDataValue(
  event: SkyewalletWebhookEvent,
  key: string
) {
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
    "customer_id"
  ];

  for (const key of preferredKeys) {
    const value = getWebhookDataValue(event, key);
    if (typeof value === "string" && value.length > 0) {
      return `${event.event}:${key}:${value}`;
    }
  }

  const payloadHash = createHash("sha256")
    .update(JSON.stringify(event))
    .digest("hex");

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
        "customer_id"
      ];
    case "swap.completed":
    case "swap.failed":
      return ["pay_reference", "swap_id", "transaction_id", "customer_id"];
    case "payout.completed":
    case "payout.failed":
    case "transfer.completed":
    case "transfer.failed":
      return ["pay_reference", "transfer_id", "transaction_id", "external_reference", "customer_id"];
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
        "customer_id"
      ];
  }
}

function snakeToCamel(value: string) {
  return value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}
