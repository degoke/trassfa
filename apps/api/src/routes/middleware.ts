import type { MiddlewareHandler } from "hono";
import { timingSafeEqual } from "node:crypto";
import { auth } from "../lib/auth.js";
import type { AppVariables } from "../lib/app-context.js";
import { env, isProduction } from "../lib/config.js";
import { logAdminAction } from "../lib/rate-limit.js";

export const sessionMiddleware: MiddlewareHandler<{
  Variables: AppVariables;
}> = async (c, next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  c.set("user", session?.user ?? null);
  c.set("session", session?.session ?? null);

  await next();
};

export const requireAuth: MiddlewareHandler<{
  Variables: AppVariables;
}> = async (c, next) => {
  if (!c.get("user")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
};

export const requireVerifiedEmail: MiddlewareHandler<{
  Variables: AppVariables;
}> = async (c, next) => {
  const user = c.get("user");

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  if (!user.emailVerified) {
    return c.json({ error: "Email verification is required before using financial features" }, 403);
  }

  await next();
};

export const requireAdmin: MiddlewareHandler<{
  Variables: AppVariables;
}> = async (c, next) => {
  const user = c.get("user");

  if (!user?.email) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const adminEmails = env.ADMIN_EMAILS;
  if (adminEmails.length === 0 || !adminEmails.includes(user.email.toLowerCase())) {
    return c.json({ error: "Forbidden" }, 403);
  }

  if (isProduction) {
    const token = c.req.header("x-admin-token");
    const expected = env.ADMIN_API_TOKEN;

    if (!token || !expected) {
      return c.json({ error: "Forbidden" }, 403);
    }

    try {
      const incoming = Buffer.from(token);
      const expectedBuffer = Buffer.from(expected);
      if (incoming.length !== expectedBuffer.length || !timingSafeEqual(incoming, expectedBuffer)) {
        return c.json({ error: "Forbidden" }, 403);
      }
    } catch {
      return c.json({ error: "Forbidden" }, 403);
    }
  }

  await next();
};

export function createAdminAuditMiddleware(action: string): MiddlewareHandler<{
  Variables: AppVariables;
}> {
  return async (c, next) => {
    await next();

    const user = c.get("user");
    if (!user?.email || c.res.status >= 400) {
      return;
    }

    logAdminAction({
      action,
      adminEmail: user.email,
      targetId: c.req.param("id"),
      metadata: {
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
      },
    });
  };
}

export function requireAuthenticatedUser(
  c: Parameters<MiddlewareHandler<{ Variables: AppVariables }>>[0],
) {
  const user = c.get("user");

  if (!user?.id || !user.email || !user.name) {
    throw new Error("Authenticated user is missing required profile fields");
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified,
    phone: user.phone ?? undefined,
  };
}
