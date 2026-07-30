import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SkyewalletWebhookEvent } from "./domain.js";
import {
  buildWebhookDedupeKey,
  extractReferenceValues,
  getWebhookDataValue,
  isUniqueReferenceKey,
  parseWebhookPayload,
  validateWebhookTimestamp,
  verifyWebhookSignature,
} from "./skyewallet-webhooks.js";

function createEvent(overrides: Partial<SkyewalletWebhookEvent> = {}): SkyewalletWebhookEvent {
  return {
    event: "payment.received",
    timestamp: String(Math.floor(Date.now() / 1000)),
    data: { pay_reference: "pay_123" },
    ...overrides,
  };
}

describe("parseWebhookPayload", () => {
  it("parses a valid webhook envelope", () => {
    const payload = createEvent();
    const parsed = parseWebhookPayload(JSON.stringify(payload));

    expect(parsed.event).toBe("payment.received");
    expect(parsed.data.pay_reference).toBe("pay_123");
  });

  it("rejects invalid JSON payloads", () => {
    expect(() => parseWebhookPayload("{not-json")).toThrow();
  });

  it("rejects payloads missing required fields", () => {
    expect(() => parseWebhookPayload(JSON.stringify({ data: {} }))).toThrow(
      "Webhook payload is missing required envelope fields",
    );
  });

  it("rejects non-object data", () => {
    expect(() =>
      parseWebhookPayload(
        JSON.stringify({
          event: "payment.received",
          timestamp: "1",
          data: [],
        }),
      ),
    ).toThrow("Webhook payload data must be an object");
  });
});

describe("verifyWebhookSignature", () => {
  const secret = "super-secret-webhook-key";
  const rawBody = JSON.stringify(createEvent());

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-01T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts a valid signature", () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", secret).update(rawBody).digest("hex");

    expect(() => verifyWebhookSignature(rawBody, { signature, timestamp }, secret)).not.toThrow();
  });

  it("rejects invalid signatures", () => {
    const timestamp = String(Math.floor(Date.now() / 1000));

    expect(() =>
      verifyWebhookSignature(rawBody, { signature: "deadbeef", timestamp }, secret),
    ).toThrow("Invalid Skyewallet webhook signature");
  });

  it("requires signature headers when a secret is configured", () => {
    expect(() => verifyWebhookSignature(rawBody, {}, secret)).toThrow(
      "Missing Skyewallet webhook signature headers",
    );
  });

  it("skips verification when no secret is configured in development", () => {
    expect(() => verifyWebhookSignature(rawBody, {}, undefined)).not.toThrow();
  });
});

describe("validateWebhookTimestamp", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-01T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts timestamps within the tolerance window", () => {
    const timestamp = String(Math.floor(Date.now() / 1000) - 60);
    expect(() => validateWebhookTimestamp(timestamp)).not.toThrow();
  });

  it("accepts millisecond timestamps", () => {
    expect(() => validateWebhookTimestamp(String(Date.now() - 60_000))).not.toThrow();
  });

  it("rejects stale timestamps", () => {
    const timestamp = String(Math.floor(Date.now() / 1000) - 600);
    expect(() => validateWebhookTimestamp(timestamp)).toThrow(
      "Webhook timestamp is outside the allowed tolerance window",
    );
  });

  it("rejects invalid timestamps", () => {
    expect(() => validateWebhookTimestamp("not-a-number")).toThrow(
      "Invalid webhook timestamp header",
    );
  });
});

describe("getWebhookDataValue", () => {
  it("reads snake_case and camelCase keys", () => {
    const event = createEvent({
      data: { payReference: "pay_camel" },
    });

    expect(getWebhookDataValue(event, "pay_reference")).toBe("pay_camel");
  });
});

describe("buildWebhookDedupeKey", () => {
  it("prefers stable reference keys", () => {
    const event = createEvent({
      data: { pay_reference: "pay_123", transaction_id: "tx_456" },
    });

    expect(buildWebhookDedupeKey(event)).toBe("payment.received:pay_reference:pay_123");
  });

  it("falls back to a payload hash when no reference exists", () => {
    const event = createEvent({ data: { amount: 100 } });
    expect(buildWebhookDedupeKey(event)).toMatch(/^payment\.received:hash:[a-f0-9]{64}$/);
  });
});

describe("extractReferenceValues", () => {
  it("extracts payment.received references in priority order", () => {
    const event = createEvent({
      data: {
        pay_reference: "pay_123",
        account_id: "acct_1",
        transaction_id: "tx_1",
      },
    });

    expect(extractReferenceValues(event)).toEqual(["pay_123", "acct_1", "tx_1"]);
  });

  it("extracts swap event references", () => {
    const event = createEvent({
      event: "swap.completed",
      data: { swap_id: "swap_1", transaction_id: "tx_1" },
    });

    expect(extractReferenceValues(event)).toEqual(["swap_1", "tx_1"]);
  });
});

describe("isUniqueReferenceKey", () => {
  it("recognizes supported reference keys", () => {
    expect(isUniqueReferenceKey("pay_reference")).toBe(true);
    expect(isUniqueReferenceKey("unknown_key")).toBe(false);
  });
});
