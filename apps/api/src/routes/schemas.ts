import { z } from "zod";

export const cryptoToBankQuoteSchema = z
  .object({
    fromCurrency: z.enum(["USDT", "USDC"]).default("USDT"),
    network: z.enum(["TRX", "SOL"]).default("TRX"),
    fromAmount: z.coerce.number().positive().optional(),
    toAmount: z.coerce.number().positive().optional(),
  })
  .refine((data) => data.fromAmount !== undefined || data.toAmount !== undefined, {
    message: "Either fromAmount or toAmount must be provided",
  });

export const bankToCryptoQuoteSchema = z.object({
  toCurrency: z.enum(["USDT", "USDC"]).default("USDT"),
  network: z.enum(["TRX", "SOL"]).default("TRX"),
  fromAmount: z.coerce.number().positive(),
});

export const bankResolutionSchema = z
  .object({
    countryCode: z.string().length(2).default("NG"),
    bankCode: z.string().optional(),
    bankName: z.string().optional(),
    accountNumber: z.string().min(10).max(10),
  })
  .refine((data) => (data.bankCode?.trim() ?? "") || (data.bankName?.trim() ?? ""), {
    message: "Either bankCode or bankName is required",
  });

export const cryptoToBankDepositSchema = z.object({
  fromCurrency: z.enum(["USDT", "USDC"]).default("USDT"),
  network: z.enum(["TRX", "SOL"]).default("TRX"),
  fromAmount: z.coerce.number().positive(),
  toAmount: z.coerce.number().positive().optional(),
});

export const cryptoToBankTransactionSchema = z.object({
  deposit: cryptoToBankDepositSchema,
  bank: bankResolutionSchema.safeExtend({
    bankName: z.string().optional(),
  }),
});

export const bankToCryptoTransactionSchema = z.object({
  fiat: z.object({
    amount: z.coerce.number().positive(),
  }),
  wallet: z.object({
    address: z.string().min(12),
    currency: z.enum(["USDT", "USDC"]).default("USDT"),
    network: z.enum(["TRX", "SOL"]).default("TRX"),
  }),
});

export type CryptoToBankQuoteInput = z.infer<typeof cryptoToBankQuoteSchema>;
export type CryptoToBankDepositInput = z.infer<typeof cryptoToBankDepositSchema>;
export type BankToCryptoQuoteInput = z.infer<typeof bankToCryptoQuoteSchema>;
export type BankResolutionInput = z.infer<typeof bankResolutionSchema>;
export type CryptoToBankTransactionInput = z.infer<typeof cryptoToBankTransactionSchema>;
export type BankToCryptoTransactionInput = z.infer<typeof bankToCryptoTransactionSchema>;
