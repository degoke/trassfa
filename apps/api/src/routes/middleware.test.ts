import type { MiddlewareHandler } from "hono";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppVariables } from "../lib/app-context.js";

const mockConfig = vi.hoisted(() => ({
  env: {
    ADMIN_EMAILS: [] as string[],
    ADMIN_API_TOKEN: "production-admin-api-token-32-chars",
  },
  isProduction: false,
}));

vi.mock("../lib/config.js", () => mockConfig);

import {
  requireAuth,
  requireAuthenticatedUser,
  requireAdmin,
  requireVerifiedEmail,
} from "./middleware.js";

type TestUser = NonNullable<AppVariables["user"]>;

function createAuthedApp(
  middleware: MiddlewareHandler<{ Variables: AppVariables }>,
  user: TestUser | null,
) {
  const app = new Hono<{ Variables: AppVariables }>();

  app.use("*", async (c, next) => {
    c.set("user", user);
    c.set("session", null);
    await next();
  });
  app.use("*", middleware);
  app.get("/test", (c) => c.json({ ok: true }));

  return app;
}

describe("requireAuth", () => {
  it("returns 401 when no user is present", async () => {
    const app = createAuthedApp(requireAuth, null);
    const response = await app.request("/test");

    expect(response.status).toBe(401);
  });

  it("allows authenticated users through", async () => {
    const app = createAuthedApp(requireAuth, {
      id: "user_1",
      email: "user@example.com",
      name: "Test User",
      emailVerified: true,
    } as TestUser);

    const response = await app.request("/test");
    expect(response.status).toBe(200);
  });
});

describe("requireVerifiedEmail", () => {
  it("blocks users with unverified email", async () => {
    const app = createAuthedApp(requireVerifiedEmail, {
      id: "user_1",
      email: "user@example.com",
      name: "Test User",
      emailVerified: false,
    } as TestUser);

    const response = await app.request("/test");
    expect(response.status).toBe(403);
  });
});

describe("requireAuthenticatedUser", () => {
  it("throws when required profile fields are missing", () => {
    expect(() =>
      requireAuthenticatedUser({
        get: (key: "user") =>
          key === "user" ? { id: "user_1", email: "user@example.com", name: "" } : undefined,
      } as never),
    ).toThrow("Authenticated user is missing required profile fields");
  });

  it("returns a normalized profile object", () => {
    const profile = requireAuthenticatedUser({
      get: (key: "user") =>
        key === "user"
          ? {
              id: "user_1",
              email: "user@example.com",
              name: "Test User",
              emailVerified: true,
              phone: "2348031234567",
            }
          : undefined,
    } as never);

    expect(profile).toEqual({
      id: "user_1",
      email: "user@example.com",
      name: "Test User",
      emailVerified: true,
      phone: "2348031234567",
    });
  });
});

describe("requireAdmin", () => {
  beforeEach(() => {
    mockConfig.isProduction = false;
    mockConfig.env.ADMIN_EMAILS = [];
  });

  afterEach(() => {
    mockConfig.isProduction = false;
    mockConfig.env.ADMIN_EMAILS = [];
  });

  it("allows configured admin emails in development", async () => {
    mockConfig.env.ADMIN_EMAILS = ["admin@example.com"];

    const app = createAuthedApp(requireAdmin, {
      id: "admin_1",
      email: "admin@example.com",
      name: "Admin User",
      emailVerified: true,
    } as TestUser);

    const response = await app.request("/test");
    expect(response.status).toBe(200);
  });

  it("rejects non-admin users", async () => {
    mockConfig.env.ADMIN_EMAILS = ["admin@example.com"];

    const app = createAuthedApp(requireAdmin, {
      id: "user_1",
      email: "user@example.com",
      name: "Test User",
      emailVerified: true,
    } as TestUser);

    const response = await app.request("/test");
    expect(response.status).toBe(403);
  });

  it("requires the admin API token in production", async () => {
    mockConfig.isProduction = true;
    mockConfig.env.ADMIN_EMAILS = ["admin@example.com"];
    mockConfig.env.ADMIN_API_TOKEN = "production-admin-api-token-32-chars";

    const app = createAuthedApp(requireAdmin, {
      id: "admin_1",
      email: "admin@example.com",
      name: "Admin User",
      emailVerified: true,
    } as TestUser);

    const unauthorized = await app.request("/test");
    expect(unauthorized.status).toBe(403);

    const authorized = await app.request("/test", {
      headers: {
        "x-admin-token": "production-admin-api-token-32-chars",
      },
    });
    expect(authorized.status).toBe(200);
  });
});
