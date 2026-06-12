import Decimal from "decimal.js";

Decimal.set({ precision: 36 });

export { Decimal };

export type FeeBreakdown = {
  linkpayFee: number;
  netAmount: number;
};

export function money(value: Decimal.Value): Decimal {
  return new Decimal(value);
}

export function roundAmount(value: Decimal.Value, places = 6): number {
  return money(value).toDecimalPlaces(places).toNumber();
}

export function formatAmount(value: Decimal.Value, places = 6): string {
  return money(value).toDecimalPlaces(places).toString();
}

export function calculateFee(
  grossAmount: Decimal.Value,
  feeBps: number,
  flatFee: Decimal.Value = 0
): FeeBreakdown {
  const gross = money(grossAmount);
  const percentageFee = gross.mul(feeBps).div(10000);
  const linkpayFee = percentageFee.plus(flatFee);
  const netAmount = Decimal.max(gross.minus(linkpayFee), 0);

  return {
    linkpayFee: roundAmount(linkpayFee),
    netAmount: roundAmount(netAmount)
  };
}

export function toNumber(value: unknown, fallback?: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }

  return fallback;
}
