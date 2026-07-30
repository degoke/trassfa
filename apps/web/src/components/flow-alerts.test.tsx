import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FlowAlerts } from "./flow-alerts";

describe("FlowAlerts", () => {
  it("renders error and feedback messages when provided", () => {
    render(<FlowAlerts error="Something went wrong" feedback="Saved successfully" />);

    expect(screen.getByText("Something went wrong")).toHaveClass("error-text");
    expect(screen.getByText("Saved successfully")).toHaveClass("success-text");
  });

  it("renders nothing when no messages are provided", () => {
    const { container } = render(<FlowAlerts />);

    expect(container).toBeEmptyDOMElement();
  });
});
