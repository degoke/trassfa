import { Hono } from "hono";
import type { AppVariables } from "../lib/app-context.js";

export function createHealthRoutes() {
  const app = new Hono<{
    Variables: AppVariables;
  }>();

  app.get("/health", (c) =>
    c.json({
      ok: true,
    }),
  );

  return app;
}
