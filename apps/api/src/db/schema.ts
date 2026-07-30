import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema.js";
import type {
  CustomerLevel,
  KycStatus,
  KycType,
  SkyewalletWebhookEvent,
  TransactionDirection,
  TransactionReference,
  TransactionStatus,
  WebhookEventStatus,
} from "../lib/domain.js";
export * from "./auth-schema.js";

export const customerProfileTable = pgTable(
  "customer_profile",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull()
      .unique(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    level: integer("level").$type<CustomerLevel>().default(0).notNull(),
    bvnVerified: boolean("bvn_verified").default(false).notNull(),
    ninVerified: boolean("nin_verified").default(false).notNull(),
    phoneVerified: boolean("phone_verified").default(false).notNull(),
    addressVerified: boolean("address_verified").default(false).notNull(),
    bvn: text("bvn"),
    nin: text("nin"),
    address: text("address"),
    city: text("city"),
    state: text("state"),
    country: text("country").default("NG").notNull(),
    dateOfBirth: text("date_of_birth"),
    skyewalletCustomerId: text("skyewallet_customer_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [index("customer_profile_user_id_idx").on(table.userId)],
);

export const permanentAddressTable = pgTable(
  "permanent_address",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull()
      .unique(),
    currency: text("currency").notNull(),
    network: text("network").notNull(),
    accountId: text("account_id").notNull(),
    address: text("address").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [index("permanent_address_user_id_idx").on(table.userId)],
);

export const permanentAccountTable = pgTable(
  "permanent_account",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull()
      .unique(),
    accountId: text("account_id").notNull(),
    bankName: text("bank_name").notNull(),
    accountNumber: text("account_number").notNull(),
    accountName: text("account_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [index("permanent_account_user_id_idx").on(table.userId)],
);

export const kycSubmissionsTable = pgTable(
  "kyc_submissions",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    type: text("type").$type<KycType>().notNull(),
    status: text("status").$type<KycStatus>().default("pending").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true, mode: "date" }),
    rejectedReason: text("rejected_reason"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("kyc_submissions_user_id_idx").on(table.userId),
    index("kyc_submissions_status_idx").on(table.status),
  ],
);

export const transactionsTable = pgTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    direction: text("direction").$type<TransactionDirection>().notNull(),
    status: text("status").$type<TransactionStatus>().notNull(),
    skyewalletCustomerId: text("skyewallet_customer_id").notNull(),
    lastEvent: jsonb("last_event").$type<SkyewalletWebhookEvent>(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("transactions_created_at_idx").on(table.createdAt),
    index("transactions_status_idx").on(table.status),
    index("transactions_owner_user_id_idx").on(table.ownerUserId),
  ],
);

export const depositBankDestinationTable = pgTable(
  "deposit_bank_destination",
  {
    id: serial("id").primaryKey(),
    transactionId: text("transaction_id")
      .references(() => transactionsTable.id, { onDelete: "cascade" })
      .notNull()
      .unique(),
    direction: text("direction").$type<TransactionDirection>().notNull(),
    depositCurrency: text("deposit_currency"),
    depositNetwork: text("deposit_network"),
    depositAmount: numeric("deposit_amount"),
    depositAccountId: text("deposit_account_id"),
    depositAddress: text("deposit_address"),
    depositExpiresAt: text("deposit_expires_at"),
    bankCountryCode: text("bank_country_code"),
    bankCode: text("bank_code"),
    bankName: text("bank_name"),
    bankAccountNumber: text("bank_account_number"),
    bankAccountName: text("bank_account_name"),
    virtualAccountId: text("virtual_account_id"),
    virtualBankName: text("virtual_bank_name"),
    virtualAccountNumber: text("virtual_account_number"),
    virtualAccountName: text("virtual_account_name"),
    virtualAccountExpiresAt: text("virtual_account_expires_at"),
    payoutAddress: text("payout_address"),
    payoutCurrency: text("payout_currency"),
    payoutNetwork: text("payout_network"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [index("deposit_bank_destination_transaction_id_idx").on(table.transactionId)],
);

export const quotePreviewTable = pgTable(
  "quote_preview",
  {
    id: serial("id").primaryKey(),
    transactionId: text("transaction_id")
      .references(() => transactionsTable.id, { onDelete: "cascade" })
      .notNull()
      .unique(),
    quoteId: text("quote_id").notNull(),
    fromCurrency: text("from_currency").notNull(),
    toCurrency: text("to_currency").notNull(),
    fromAmount: numeric("from_amount").notNull(),
    grossAmount: numeric("gross_amount").notNull(),
    providerFee: numeric("provider_fee").notNull(),
    linkpayFee: numeric("linkpay_fee").notNull(),
    netAmount: numeric("net_amount").notNull(),
    rate: numeric("rate").notNull(),
    expiresAt: text("expires_at"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [index("quote_preview_transaction_id_idx").on(table.transactionId)],
);

export const payoutDetailsTable = pgTable(
  "payout_details",
  {
    id: serial("id").primaryKey(),
    transactionId: text("transaction_id")
      .references(() => transactionsTable.id, { onDelete: "cascade" })
      .notNull()
      .unique(),
    payoutId: text("payout_id").notNull(),
    status: text("status").notNull(),
    amount: numeric("amount").notNull(),
    currency: text("currency").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [index("payout_details_transaction_id_idx").on(table.transactionId)],
);

export const transactionReferencesTable = pgTable(
  "transaction_references",
  {
    id: serial("id").primaryKey(),
    transactionId: text("transaction_id")
      .references(() => transactionsTable.id, { onDelete: "cascade" })
      .notNull(),
    type: text("type").notNull(),
    value: text("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("transaction_references_transaction_id_idx").on(table.transactionId),
    index("transaction_references_value_idx").on(table.value),
    uniqueIndex("transaction_references_transaction_id_type_value_uidx").on(
      table.transactionId,
      table.type,
      table.value,
    ),
  ],
);

export const webhookEventsTable = pgTable(
  "webhook_events",
  {
    id: serial("id").primaryKey(),
    dedupeKey: text("dedupe_key").notNull(),
    event: text("event").notNull(),
    payload: jsonb("payload").$type<SkyewalletWebhookEvent>().notNull(),
    status: text("status").$type<WebhookEventStatus>().notNull().default("pending"),
    matchedTransactionId: text("matched_transaction_id").references(() => transactionsTable.id, {
      onDelete: "set null",
    }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    processedAt: timestamp("processed_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [
    uniqueIndex("webhook_events_dedupe_key_uidx").on(table.dedupeKey),
    index("webhook_events_status_idx").on(table.status),
  ],
);

export const phoneOtpChallengesTable = pgTable(
  "phone_otp_challenges",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    phone: text("phone").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [index("phone_otp_challenges_user_id_idx").on(table.userId)],
);

export type TransactionRow = typeof transactionsTable.$inferSelect;
export type CustomerProfileRow = typeof customerProfileTable.$inferSelect;
export type DepositBankDestinationRow = typeof depositBankDestinationTable.$inferSelect;
export type QuotePreviewRow = typeof quotePreviewTable.$inferSelect;
export type PayoutDetailsRowRaw = typeof payoutDetailsTable.$inferSelect;
export type PermanentAddressRow = typeof permanentAddressTable.$inferSelect;
export type PermanentAccountRow = typeof permanentAccountTable.$inferSelect;
export type KycSubmissionRow = typeof kycSubmissionsTable.$inferSelect;
export type TransactionReferenceRow = typeof transactionReferencesTable.$inferSelect;
export type WebhookEventRow = typeof webhookEventsTable.$inferSelect;

export type TransactionInsert = typeof transactionsTable.$inferInsert;
export type TransactionReferenceInsert = typeof transactionReferencesTable.$inferInsert;
export type WebhookEventInsert = typeof webhookEventsTable.$inferInsert;

export type TransactionWithReferences = {
  row: TransactionRow;
  references: TransactionReference[];
};
