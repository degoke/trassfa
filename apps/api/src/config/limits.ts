export type LevelLimits = {
  maxTransactionAmount: number;
  maxDailyAmount: number;
};

export type LevelPermissions = {
  allowPermanentAddress: boolean;
  allowPermanentAccount: boolean;
};

export const currencyLevelLimits: Record<string, Record<number, LevelLimits>> = {
  NGN: {
    0: { maxTransactionAmount: 100_000, maxDailyAmount: 200_000 },
    1: { maxTransactionAmount: 500_000, maxDailyAmount: 1_000_000 },
    3: { maxTransactionAmount: 10_000_000, maxDailyAmount: 20_000_000 },
  },
  USDT: {
    0: { maxTransactionAmount: 500, maxDailyAmount: 1_000 },
    1: { maxTransactionAmount: 5_000, maxDailyAmount: 10_000 },
    3: { maxTransactionAmount: 50_000, maxDailyAmount: 100_000 },
  },
  USDC: {
    0: { maxTransactionAmount: 500, maxDailyAmount: 1_000 },
    1: { maxTransactionAmount: 5_000, maxDailyAmount: 10_000 },
    3: { maxTransactionAmount: 50_000, maxDailyAmount: 100_000 },
  },
};

export const levelPermissions: Record<number, LevelPermissions> = {
  0: { allowPermanentAddress: false, allowPermanentAccount: false },
  1: { allowPermanentAddress: true, allowPermanentAccount: true },
  3: { allowPermanentAddress: true, allowPermanentAccount: true },
};
