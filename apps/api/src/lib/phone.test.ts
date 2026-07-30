import { describe, expect, it } from "vitest";
import { normalizePhone } from "./phone.js";

describe("normalizePhone", () => {
  it("converts local 11-digit numbers starting with 0", () => {
    expect(normalizePhone("08031234567")).toBe("2348031234567");
  });

  it("strips formatting characters", () => {
    expect(normalizePhone("+234 (803) 123-4567")).toBe("2348031234567");
  });

  it("keeps already-normalized numbers", () => {
    expect(normalizePhone("2348031234567")).toBe("2348031234567");
  });

  it("converts bare 10-digit numbers", () => {
    expect(normalizePhone("8031234567")).toBe("2348031234567");
  });

  it("deduplicates repeated country codes", () => {
    expect(normalizePhone("2342348031234567")).toBe("2348031234567");
  });

  it("returns unrecognized input unchanged", () => {
    expect(normalizePhone("12345")).toBe("12345");
  });
});
