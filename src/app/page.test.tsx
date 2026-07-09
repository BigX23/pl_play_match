import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import LandingPage from "./page";

describe("LandingPage", () => {
  it("renders hero heading and copy", () => {
    render(<LandingPage />);
    expect(screen.getByText(/Find a tennis and pickleball partner/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Pleasanton/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/PlayMatch/i).length).toBeGreaterThan(0);
  });

  it("renders CTAs linking to /register and /login", () => {
    render(<LandingPage />);
    const registerLinks = screen.getAllByRole("link").filter((a) => a.getAttribute("href") === "/register");
    const loginLinks = screen.getAllByRole("link").filter((a) => a.getAttribute("href") === "/login");
    expect(registerLinks.length).toBeGreaterThan(0);
    expect(loginLinks.length).toBeGreaterThan(0);
    expect(screen.getByText("Get Started")).toBeInTheDocument();
    expect(screen.getByText("Sign In")).toBeInTheDocument();
  });

  it("renders the mock match card with the two players", () => {
    render(<LandingPage />);
    expect(screen.getByText("Your Top Matches")).toBeInTheDocument();
    expect(screen.getByText("Maya Okonkwo")).toBeInTheDocument();
    expect(screen.getByText("Sam Tan")).toBeInTheDocument();
    expect(screen.getByText("92%")).toBeInTheDocument();
    expect(screen.getByText("78%")).toBeInTheDocument();
    expect(screen.getByText(/Send a match request to start a chat/i)).toBeInTheDocument();
  });

  it("renders the footer", () => {
    render(<LandingPage />);
    expect(screen.getByText(/Pleasanton PlayMatch/i)).toBeInTheDocument();
  });
});
