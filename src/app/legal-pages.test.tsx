import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { existsSync, readFileSync } from "fs";
import path from "path";
import PrivacyPage from "./privacy/page";
import TermsPage from "./terms/page";
import SupportPage from "./support/page";

// These pages are rendered WITHOUT an AuthProvider or next/navigation mocks on
// purpose: useAuth() throws outside its provider, so a page that accidentally
// starts depending on auth fails here.

const hrefs = () => screen.getAllByRole("link").map((a) => a.getAttribute("href"));
const mailtos = () => hrefs().filter((h) => h?.startsWith("mailto:feedback@aiplaymatch.com"));

describe("legal pages", () => {
  it("privacy policy renders key sections, last-updated date, and contact", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeInTheDocument();
    for (const h of [
      /Information we collect/,
      /Who can see your information/,
      /Rally, the AI assistant/,
      /Service providers and sharing/,
      /How long we keep it/,
      /Deleting your account/,
      /California privacy rights/,
      /Children/,
    ]) {
      expect(screen.getByRole("heading", { level: 2, name: h })).toBeInTheDocument();
    }
    expect(screen.getByText("October 31, 2026")).toHaveAttribute("dateTime", "2026-10-31");
    expect(screen.getByText(/not sent to or shared with any third-party AI provider/i)).toBeInTheDocument();
    expect(mailtos().length).toBeGreaterThan(0);
  });

  it("terms render zero-tolerance, reporting, Apple EULA terms, and contact", () => {
    render(<TermsPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Terms of Use" })).toBeInTheDocument();
    expect(screen.getByText(/zero tolerance for objectionable content and abusive users/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /Blocking, reporting, and moderation/ })).toBeInTheDocument();
    expect(screen.getByText(/within 24 hours/i)).toBeInTheDocument();
    expect(screen.getByText(/17 years old/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /Apple App Store and Google Play/ })).toBeInTheDocument();
    expect(screen.getByText(/not with Apple or Google/i)).toBeInTheDocument();
    expect(screen.getByText(/laws of the State of California/i)).toBeInTheDocument();
    expect(screen.getByText("October 31, 2026")).toBeInTheDocument();
    expect(mailtos().length).toBeGreaterThan(0);
  });

  it("support page renders FAQ, contact, and policy links", () => {
    render(<SupportPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Support" })).toBeInTheDocument();
    for (const q of [/How do I sign in/, /notifications on my iPhone/, /block or report/, /What is Rally/, /delete my account/]) {
      expect(screen.getByRole("heading", { level: 3, name: q })).toBeInTheDocument();
    }
    expect(screen.getByText(/Add to Home Screen/)).toBeInTheDocument();
    expect(mailtos().length).toBeGreaterThan(0);
    expect(hrefs()).toEqual(expect.arrayContaining(["/privacy", "/terms"]));
    expect(screen.getByText("October 31, 2026")).toBeInTheDocument();
  });

  it.each([PrivacyPage, TermsPage, SupportPage])("each page links to all three legal pages in the footer", (Page) => {
    render(<Page />);
    const nav = screen.getByRole("navigation", { name: /legal and support/i });
    const navHrefs = Array.from(nav.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(navHrefs).toEqual(["/privacy", "/terms", "/support"]);
  });
});

describe("legal routes are public (not auth-gated)", () => {
  const appDir = path.resolve(__dirname);
  const srcDir = path.resolve(appDir, "..");

  it.each(["privacy", "terms", "support"])("/%s lives outside the protected dashboard and has no auth dependency", (route) => {
    const file = path.join(appDir, route, "page.tsx");
    expect(existsSync(file)).toBe(true);
    // Only /dashboard/* is wrapped in <ProtectedRoute> (dashboard/layout.tsx).
    expect(path.relative(path.join(appDir, "dashboard"), file).startsWith("..")).toBe(true);
    // No route-level layout that could add a gate.
    expect(existsSync(path.join(appDir, route, "layout.tsx"))).toBe(false);
    const src = readFileSync(file, "utf8");
    expect(src).not.toMatch(/ProtectedRoute|useAuth|from "@\/auth"|redirect\(/);
    // Server component (static) — not a client page.
    expect(src).not.toMatch(/^\s*["']use client["']/m);
  });

  it("no middleware gates routes (if one is added, it must exclude the legal pages)", () => {
    const mw = ["middleware.ts", "middleware.js"].map((f) => path.join(srcDir, f)).find(existsSync);
    if (!mw) return;
    const src = readFileSync(mw, "utf8");
    for (const route of ["privacy", "terms", "support"]) expect(src).toContain(route);
  });
});
