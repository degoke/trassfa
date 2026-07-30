import { describe, expect, it } from "vitest";
import { createHealthRoutes } from "./health.js";

describe("createHealthRoutes", () => {
  it("returns a healthy status payload", async () => {
    const app = createHealthRoutes();
    const response = await app.request("/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
});
