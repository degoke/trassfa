import { describe, expect, it } from "vitest";
import { calculateFee, formatAmount, roundAmount, toNumber } from "./money.js";
import {
  decryptSensitive,
  encryptSensitive,
  hashOtp,
  maskSensitiveIdentifier,
} from "./encryption.js";

describe("calculateFee", () => {
  it("applies percentage and flat fees", () => {
    const result = calculateFee(10_000, 120, 50);

    expect(result.platformFee).toBe(170);
    expect(result.netAmount).toBe(9_830);
  });

  it("never returns a negative net amount", () => {
    const result = calculateFee(10, 120, 50);

    expect(result.netAmount).toBe(0);
  });
});

describe("roundAmount", () => {
  it("rounds to the requested decimal places", () => {
    expect(roundAmount("10.1234567", 2)).toBe(10.12);
    expect(roundAmount("10.1234567", 4)).toBe(10.1235);
  });
});

describe("formatAmount", () => {
  it("returns a decimal string with the requested precision", () => {
    expect(formatAmount("10.1234567", 4)).toBe("10.1235");
  });
});

describe("toNumber", () => {
  it("parses numeric strings and numbers", () => {
    expect(toNumber("42.5")).toBe(42.5);
    expect(toNumber(12)).toBe(12);
  });

  it("returns the fallback for invalid values", () => {
    expect(toNumber("not-a-number", 0)).toBe(0);
    expect(toNumber(undefined)).toBeUndefined();
  });
});

describe("encryption", () => {
  it("encrypts and decrypts sensitive values", () => {
    const encrypted = encryptSensitive("12345678901");
    expect(encrypted.startsWith("enc:v1:")).toBe(true);
    expect(decryptSensitive(encrypted)).toBe("12345678901");
  });

  it("masks sensitive identifiers", () => {
    expect(maskSensitiveIdentifier("12345678901")).toBe("***8901");
  });

  it("hashes OTP codes deterministically", () => {
    expect(hashOtp("123456")).toBe(hashOtp("123456"));
    expect(hashOtp("123456")).not.toBe(hashOtp("654321"));
  });
});
