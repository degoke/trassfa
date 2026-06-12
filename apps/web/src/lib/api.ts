const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

export type QuoteResponse = {
  quote: {
    quoteId: string;
    fromCurrency: string;
    toCurrency: string;
    fromAmount: number;
    grossAmount: number;
    providerFee: number;
    linkpayFee: number;
    netAmount: number;
    rate: number;
    expiresAt?: string;
  };
};

export type Bank = {
  name: string;
  slug: string;
  code: string;
};

export type Profile = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  level: number;
  bvnVerified: boolean;
  ninVerified: boolean;
  phoneVerified: boolean;
  addressVerified: boolean;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  dateOfBirth: string | null;
};

export type ProfileLimits = {
  level: number;
  limits: Record<string, unknown>;
  permissions: Record<string, boolean>;
};

export type PermanentAddress = {
  currency: string;
  network: string;
  accountId: string;
  address: string;
};

export type PermanentAccount = {
  accountId: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
};

export type Transaction =
  | {
      id: string;
      direction: "crypto_to_bank";
      status: string;
      createdAt: string;
      updatedAt: string;
      deposit: {
        currency: string;
        network: string;
        amount: number;
        address: string;
        expiresAt?: string;
      };
      bankDestination: {
        countryCode: string;
        bankCode: string;
        bankName?: string;
        accountNumber: string;
        accountName: string;
      };
      quote: QuoteResponse["quote"];
      payout?: { id: string; status: string; amount: number; currency: string };
      error?: string;
    }
  | {
      id: string;
      direction: "bank_to_crypto";
      status: string;
      createdAt: string;
      updatedAt: string;
      virtualAccount: {
        bankName: string;
        accountName: string;
        accountNumber: string;
        expiresAt?: string;
      };
      payoutDestination: {
        address: string;
        currency: string;
        network: string;
      };
      quote: QuoteResponse["quote"];
      payout?: { id: string; status: string; amount: number; currency: string };
      error?: string;
    };

async function request<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed");
  }

  return payload as T;
}

export function listBanks(countryCode = "NG") {
  return request<{ banks: Bank[] }>(`/api/banks?countryCode=${countryCode}`);
}

export function resolveBankAccount(input: {
  countryCode: string;
  bankCode?: string;
  bankName?: string;
  accountNumber: string;
}) {
  return request<{
    accountName: string;
    bankCode: string;
    accountNumber: string;
    countryCode: string;
  }>("/api/banks/resolve", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getCryptoToBankQuote(input: {
  fromCurrency: "USDT" | "USDC";
  network: "TRX" | "SOL";
  fromAmount?: number;
  toAmount?: number;
}) {
  return request<QuoteResponse>("/api/quotes/crypto-to-bank", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getBankToCryptoQuote(input: {
  toCurrency: "USDT" | "USDC";
  network: "TRX" | "SOL";
  fromAmount: number;
}) {
  return request<QuoteResponse>("/api/quotes/bank-to-crypto", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listTransactions() {
  return request<{ transactions: Transaction[] }>("/api/transactions");
}

export function getTransaction(id: string) {
  return request<{ transaction: Transaction }>(`/api/transactions/${id}`);
}

export function getProfile() {
  return request<{ profile: Profile }>("/api/profile");
}

export function getProfileLimits() {
  return request<ProfileLimits>("/api/profile/limits");
}

export function getPermanentAddress() {
  return request<{ address: PermanentAddress | null }>(
    "/api/profile/permanent-address",
  );
}

export function getPermanentAccount() {
  return request<{ account: PermanentAccount | null }>(
    "/api/profile/permanent-account",
  );
}

export function createCryptoToBankTransaction(input: unknown) {
  return request<{ transaction: Transaction }>(
    "/api/transactions/crypto-to-bank",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function createBankToCryptoTransaction(input: unknown) {
  return request<{ transaction: Transaction }>(
    "/api/transactions/bank-to-crypto",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function validateAddress(input: {
  address: string;
  currency: string;
  network: string;
}) {
  return request<{ valid: boolean; message?: string }>(
    "/api/wallets/validate",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}
