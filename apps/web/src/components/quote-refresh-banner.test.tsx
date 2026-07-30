import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuoteRefreshBanner } from "./quote-refresh-banner";

describe("QuoteRefreshBanner", () => {
  it("shows a refreshing state", () => {
    render(<QuoteRefreshBanner isRefreshing refreshSeconds={30} />);

    expect(screen.getByText("Refreshing...")).toBeInTheDocument();
  });

  it("shows the countdown when a refresh is scheduled", () => {
    render(<QuoteRefreshBanner isRefreshing={false} refreshSeconds={75} />);

    expect(screen.getByText("01:15")).toBeInTheDocument();
  });
});
