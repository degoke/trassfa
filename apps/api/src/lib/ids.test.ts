import { describe, expect, it } from "vitest";
import { createId } from "./ids.js";

describe("createId", () => {
  it("prefixes generated identifiers", () => {
    const id = createId("tx");

    expect(id.startsWith("tx_")).toBe(true);
    expect(id.length).toBeGreaterThan(4);
  });

  it("generates unique values", () => {
    const first = createId("tx");
    const second = createId("tx");

    expect(first).not.toBe(second);
  });
});
