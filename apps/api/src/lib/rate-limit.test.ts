import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { createRateLimiter, getClientIp } from "../lib/rate-limit.js";

describe("createRateLimiter", () => {
  it("allows requests until the limit is reached", async () => {
    const app = new Hono();
    const limiter = createRateLimiter({
      keyPrefix: "test-limit",
      limit: 2,
      windowMs: 60_000,
      keyResolver: () => "client-a",
    });

    app.use("*", limiter);
    app.get("/", (c) => c.json({ ok: true }));

    expect((await app.request("/")).status).toBe(200);
    expect((await app.request("/")).status).toBe(200);
    expect((await app.request("/")).status).toBe(429);
  });
});

describe("getClientIp", () => {
  it("uses the first forwarded IP when present", async () => {
    const app = new Hono();
    app.get("/", (c) => c.json({ ip: getClientIp(c) }));

    const response = await app.request("/", {
      headers: {
        "x-forwarded-for": "203.0.113.1, 198.51.100.2",
      },
    });

    expect(await response.json()).toEqual({ ip: "203.0.113.1" });
  });

  it("falls back to x-real-ip", async () => {
    const app = new Hono();
    app.get("/", (c) => c.json({ ip: getClientIp(c) }));

    const response = await app.request("/", {
      headers: {
        "x-real-ip": "198.51.100.10",
      },
    });

    expect(await response.json()).toEqual({ ip: "198.51.100.10" });
  });
});
