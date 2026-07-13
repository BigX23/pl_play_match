import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import RallyTyping from "./rally-typing";

describe("RallyTyping", () => {
  it("renders an accessible 'Rally is typing' status with the Rally label", () => {
    render(<RallyTyping />);
    expect(screen.getByRole("status", { name: /rally is typing/i })).toBeInTheDocument();
    expect(screen.getByText("Rally")).toBeInTheDocument();
    expect(screen.getByText(/rally is typing/i)).toBeInTheDocument();
  });
});
