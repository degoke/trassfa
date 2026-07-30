import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getCryptoToBankQuote,
  getProfile,
  getTransaction,
  listBanks,
  listTransactions,
  resolveBankAccount,
  validateAddress,
} from "./api";

describe("api client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests banks with credentials included", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ banks: [{ name: "GTBank", slug: "gtb", code: "058" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await listBanks("NG");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8787/api/banks?countryCode=NG",
      expect.objectContaining({
        credentials: "include",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );
    expect(result.banks).toHaveLength(1);
  });

  it("posts JSON payloads for mutations", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        accountName: "Test User",
        bankCode: "058",
        accountNumber: "0123456789",
        countryCode: "NG",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await resolveBankAccount({
      countryCode: "NG",
      bankCode: "058",
      accountNumber: "0123456789",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8787/api/banks/resolve",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          countryCode: "NG",
          bankCode: "058",
          accountNumber: "0123456789",
        }),
      }),
    );
  });

  it("loads profile and transaction resources", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ profile: { id: "user_1" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ transactions: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ transaction: { id: "tx_1" } }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await getProfile();
    await listTransactions();
    await getTransaction("tx_1");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8787/api/profile",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8787/api/transactions",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8787/api/transactions/tx_1",
      expect.any(Object),
    );
  });

  it("validates wallet addresses", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ valid: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await validateAddress({
      address: "TXyz1234567890",
      currency: "USDT",
      network: "TRX",
    });

    expect(result.valid).toBe(true);
  });

  it("throws API errors with the server message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Unauthorized" }),
      }),
    );

    await expect(
      getCryptoToBankQuote({
        fromCurrency: "USDT",
        network: "TRX",
        fromAmount: 100,
      }),
    ).rejects.toThrow("Unauthorized");
  });

  it("falls back to a generic error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({}),
      }),
    );

    await expect(listTransactions()).rejects.toThrow("Request failed");
  });
});
