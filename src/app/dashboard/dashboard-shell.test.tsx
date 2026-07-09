import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardShell from "./dashboard-shell";

vi.mock("@/components/desktop-sidebar", () => ({ default: () => <div data-testid="sidebar" /> }));
vi.mock("@/components/bottom-nav", () => ({ default: () => <div data-testid="bottomnav" /> }));
vi.mock("@/components/protected-route", () => ({ default: ({ children }: { children: React.ReactNode }) => <div data-testid="protected">{children}</div> }));

describe("DashboardShell", () => {
  it("wraps children in ProtectedRoute with nav chrome", () => {
    render(<DashboardShell><p>child content</p></DashboardShell>);
    expect(screen.getByTestId("protected")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("bottomnav")).toBeInTheDocument();
    expect(screen.getByText("child content")).toBeInTheDocument();
  });
});
