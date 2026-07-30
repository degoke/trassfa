import { describe, expect, it } from "vitest";
import {
  buildReceiptShareText,
  formatAsset,
  formatNaira,
  getTransactionDirectionLabel,
  getTransactionProgress,
  isTerminalStatus,
  statusLabel,
} from "./transaction-ui";
import { createBankToCryptoTransaction, createCryptoToBankTransaction } from "../test/fixtures";

describe("statusLabel", () => {
  it("maps known statuses to user-facing labels", () => {
    expect(statusLabel("awaiting_payment")).toBe("Awaiting payment");
    expect(statusLabel("custom_status")).toBe("custom_status");
  });
});

describe("isTerminalStatus", () => {
  it("identifies terminal transaction states", () => {
    expect(isTerminalStatus("completed")).toBe(true);
    expect(isTerminalStatus("failed")).toBe(true);
    expect(isTerminalStatus("expired")).toBe(true);
    expect(isTerminalStatus("awaiting_payment")).toBe(false);
  });
});

describe("formatNaira", () => {
  it("formats valid amounts and handles empty values", () => {
    expect(formatNaira(1500)).toContain("1,500");
    expect(formatNaira(null)).toBe("--");
  });
});

describe("formatAsset", () => {
  it("formats numeric and string amounts with currency", () => {
    expect(formatAsset(12.5, "USDT")).toBe("12.5 USDT");
    expect(formatAsset("15", "USDC")).toBe("15 USDC");
    expect(formatAsset(null, "USDT")).toBe("-- USDT");
  });
});

describe("getTransactionDirectionLabel", () => {
  it("returns Send for crypto-to-bank and Receive otherwise", () => {
    expect(getTransactionDirectionLabel(createCryptoToBankTransaction())).toBe("Send");
    expect(getTransactionDirectionLabel(createBankToCryptoTransaction())).toBe("Receive");
  });
});

describe("getTransactionProgress", () => {
  it("marks the awaiting payment step as active initially", () => {
    const items = getTransactionProgress(createCryptoToBankTransaction());

    expect(items[0]?.state).toBe("active");
    expect(items[1]?.state).toBe("pending");
  });

  it("adds an expired step when the transaction expired", () => {
    const items = getTransactionProgress(createCryptoToBankTransaction({ status: "expired" }));

    expect(items.some((item) => item.key === "expired" && item.state === "active")).toBe(true);
  });

  it("marks payout as active when a transaction failed", () => {
    const items = getTransactionProgress(createCryptoToBankTransaction({ status: "failed" }));

    expect(items[2]?.state).toBe("active");
    expect(items[2]?.description).toContain("could not be completed");
  });
});

describe("buildReceiptShareText", () => {
  it("includes settlement details for crypto-to-bank receipts", () => {
    const receipt = buildReceiptShareText(createCryptoToBankTransaction());

    expect(receipt).toContain("RECEIPT");
    expect(receipt).toContain("Estimated settlement");
    expect(receipt).toContain("tx_crypto_bank_1");
    expect(receipt).toContain("Test User");
    expect(receipt).toContain("0123456789");
  });

  it("includes wallet details for bank-to-crypto receipts", () => {
    const receipt = buildReceiptShareText(createBankToCryptoTransaction());

    expect(receipt).toContain("You paid:");
    expect(receipt).toContain("Wallet:");
    expect(receipt).toContain("TXyz1234567890");
  });
});
