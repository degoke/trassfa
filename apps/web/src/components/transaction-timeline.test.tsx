import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TransactionTimeline } from "./transaction-timeline";
import { createCryptoToBankTransaction } from "../test/fixtures";

describe("TransactionTimeline", () => {
  it("renders progress steps for a transaction", () => {
    render(<TransactionTimeline tx={createCryptoToBankTransaction()} />);

    expect(screen.getByText("Awaiting payment")).toBeInTheDocument();
    expect(screen.getByText("Payment received")).toBeInTheDocument();
    expect(screen.getByText("Sending payout")).toBeInTheDocument();
    expect(screen.getByText("Payout completed")).toBeInTheDocument();
  });
});
