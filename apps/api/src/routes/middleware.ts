import type { MiddlewareHandler } from "hono";
import { auth } from "../lib/auth.js";
import type { AppVariables } from "../lib/app-context.js";

export const sessionMiddleware: MiddlewareHandler<{
  Variables: AppVariables;
}> = async (c, next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers
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

export function requireAuthenticatedUser(
  c: Parameters<MiddlewareHandler<{ Variables: AppVariables }>>[0]
) {
  const user = c.get("user");

  if (!user?.id || !user.email || !user.name) {
    throw new Error("Authenticated user is missing required profile fields");
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone ?? undefined
  };
}
