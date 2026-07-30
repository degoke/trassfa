import type { Transaction } from "../lib/api";

export function createCryptoToBankTransaction(
  overrides: Partial<Extract<Transaction, { direction: "crypto_to_bank" }>> = {},
): Extract<Transaction, { direction: "crypto_to_bank" }> {
  return {
    id: "tx_crypto_bank_1",
    direction: "crypto_to_bank",
    status: "awaiting_payment",
    createdAt: "2024-06-01T10:00:00.000Z",
    updatedAt: "2024-06-01T10:00:00.000Z",
    deposit: {
      currency: "USDT",
      network: "TRX",
      amount: 100,
      address: "TXyz1234567890",
    },
    bankDestination: {
      countryCode: "NG",
      bankCode: "058",
      bankName: "GTBank",
      accountNumber: "0123456789",
      accountName: "Test User",
    },
    quote: {
      quoteId: "quote_1",
      fromCurrency: "USDT",
      toCurrency: "NGN",
      fromAmount: 100,
      grossAmount: 150_000,
      providerFee: 0,
      platformFee: 1_850,
      netAmount: 148_150,
      rate: 1_500,
    },
    ...overrides,
  };
}

export function createBankToCryptoTransaction(
  overrides: Partial<Extract<Transaction, { direction: "bank_to_crypto" }>> = {},
): Extract<Transaction, { direction: "bank_to_crypto" }> {
  return {
    id: "tx_bank_crypto_1",
    direction: "bank_to_crypto",
    status: "awaiting_payment",
    createdAt: "2024-06-01T10:00:00.000Z",
    updatedAt: "2024-06-01T10:00:00.000Z",
    virtualAccount: {
      bankName: "Wema Bank",
      accountName: "Test User",
      accountNumber: "1234567890",
    },
    payoutDestination: {
      address: "TXyz1234567890",
      currency: "USDT",
      network: "TRX",
    },
    quote: {
      quoteId: "quote_2",
      fromCurrency: "NGN",
      toCurrency: "USDT",
      fromAmount: 100_000,
      grossAmount: 65,
      providerFee: 0,
      platformFee: 1,
      netAmount: 64,
      rate: 0.00065,
    },
    ...overrides,
  };
}
