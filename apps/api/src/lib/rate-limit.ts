import type { MiddlewareHandler } from "hono";
import { logger } from "./logger.js";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function createRateLimiter(options: {
  keyPrefix: string;
  limit: number;
  windowMs: number;
  keyResolver: (c: Parameters<MiddlewareHandler>[0]) => string;
}): MiddlewareHandler {
  return async (c, next) => {
    const key = `${options.keyPrefix}:${options.keyResolver(c)}`;
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      await next();
      return;
    }

    if (bucket.count >= options.limit) {
      return c.json({ error: "Too many requests" }, 429);
    }

    bucket.count += 1;
    await next();
  };
}

export function getClientIp(c: Parameters<MiddlewareHandler>[0]) {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }

  return c.req.header("x-real-ip") ?? "unknown";
}

export function logAdminAction(input: {
  action: string;
  adminEmail: string;
  targetId?: string | number;
  metadata?: Record<string, unknown>;
}) {
  logger.warn("[admin-audit]", input);
}
