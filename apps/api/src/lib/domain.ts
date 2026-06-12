export type TransactionDirection = "crypto_to_bank" | "bank_to_crypto";

export type TransactionStatus =
  | "awaiting_payment"
  | "payment_received"
  | "swapping"
  | "payout_pending"
  | "completed"
  | "failed"
  | "expired";

export type ReferenceType =
  | "internal"
  | "customer"
  | "pay_reference"
  | "provider_transaction"
  | "payment_account"
  | "payment_address"
  | "virtual_account"
  | "swap"
  | "transfer";

export type TransactionReference = {
  type: ReferenceType;
  value: string;
};

export type CustomerLevel = 0 | 1 | 3;

export type CustomerProfile = {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  level: CustomerLevel;
  bvnVerified: boolean;
  ninVerified: boolean;
  phoneVerified: boolean;
  addressVerified: boolean;
  bvn?: string;
  nin?: string;
  address?: string;
  city?: string;
  state?: string;
  country: string;
  dateOfBirth?: string;
};

export type AuthenticatedUserProfile = {
  id: string;
  name: string;
  email: string;
  phone?: string;
};

export type QuotePreview = {
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

export type PayoutDetails = {
  id: string;
  status: string;
  amount: number;
  currency: string;
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

export type KycType = "bvn" | "nin" | "address" | "phone";
export type KycStatus = "pending" | "verified" | "rejected";

export type KycSubmission = {
  id: number;
  userId: string;
  type: KycType;
  status: KycStatus;
  data: Record<string, unknown>;
  verifiedAt?: string;
  rejectedReason?: string;
  createdAt: string;
  updatedAt: string;
};

export type SkyewalletWebhookEvent = {
  event: string;
  data: Record<string, unknown>;
  timestamp: string | number;
};

export type WebhookEventStatus =
  | "pending"
  | "processing"
  | "processed"
  | "ignored"
  | "failed";

export type WebhookEventRecord = {
  id: number;
  dedupeKey: string;
  event: string;
  payload: SkyewalletWebhookEvent;
  status: WebhookEventStatus;
  matchedTransactionId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
  processedAt?: string;
};

export type CryptoToBankTransaction = {
  id: string;
  ownerUserId: string;
  direction: "crypto_to_bank";
  status: TransactionStatus;
  createdAt: string;
  updatedAt: string;
  customer: CustomerProfile;
  skyewalletCustomerId: string;
  deposit: {
    currency: string;
    network: string;
    amount: number;
    accountId: string;
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
  quote: QuotePreview;
  payout?: PayoutDetails;
  references: TransactionReference[];
  lastEvent?: SkyewalletWebhookEvent;
  error?: string;
};

export type BankToCryptoTransaction = {
  id: string;
  ownerUserId: string;
  direction: "bank_to_crypto";
  status: TransactionStatus;
  createdAt: string;
  updatedAt: string;
  customer: CustomerProfile;
  skyewalletCustomerId: string;
  virtualAccount: {
    accountId: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    address?: string;
    expiresAt?: string;
  };
  payoutDestination: {
    address: string;
    currency: string;
    network: string;
  };
  quote: QuotePreview;
  payout?: PayoutDetails;
  references: TransactionReference[];
  lastEvent?: SkyewalletWebhookEvent;
  error?: string;
};

export type LinkPayTransaction = CryptoToBankTransaction | BankToCryptoTransaction;

export type DepositBankDestination = {
  direction: TransactionDirection;
  deposit?: {
    currency: string;
    network: string;
    amount: number;
    accountId: string;
    address: string;
    expiresAt?: string;
  };
  bankDestination?: {
    countryCode: string;
    bankCode: string;
    bankName?: string;
    accountNumber: string;
    accountName: string;
  };
  virtualAccount?: {
    accountId: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    address?: string;
    expiresAt?: string;
  };
  payoutDestination?: {
    address: string;
    currency: string;
    network: string;
  };
};
