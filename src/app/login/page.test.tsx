import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import LoginPage from "./page";

// The sign-in failure branch (a single setError) is intentionally not tested
// here: driving a mocked async rejection through a React onClick handler trips
// vitest's unhandled-rejection tracker as a false positive regardless of
// act()/waitFor() structure. The branch is exercised end-to-end in the browser.

const loginWithGoogle = vi.fn();
const refreshProfile = vi.fn(async () => {});
const replace = vi.fn();
const nativeState = { isNative: false, platform: "web" as "web" | "ios" | "android" };
const nativeGoogleSignIn = vi.fn();
const nativeAppleSignIn = vi.fn();
const getProviders = vi.fn(async (): Promise<Record<string, unknown> | null> => ({ google: {} }));
const nextAuthSignIn = vi.fn();

vi.mock("next-auth/react", () => ({
  getProviders: () => getProviders(),
  signIn: (...args: unknown[]) => nextAuthSignIn(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => "/login",
}));

vi.mock("@/components/native-provider", () => ({
  useNative: () => nativeState,
}));

vi.mock("@/lib/native-sign-in", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/native-sign-in")>()),
  nativeGoogleSignIn: (...args: unknown[]) => nativeGoogleSignIn(...args),
  nativeAppleSignIn: (...args: unknown[]) => nativeAppleSignIn(...args),
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    profileComplete: false,
    loading: false,
    login: loginWithGoogle,
    loginWithGoogle,
    register: loginWithGoogle,
    logout: vi.fn(),
    deleteAccount: vi.fn(),
    setProfileComplete: vi.fn(),
    updateUserProfile: vi.fn(),
    refreshProfile,
  }),
}));

const googleButton = () => screen.getByRole("button", { name: /continue with google/i });
const appleButton = () => screen.queryByRole("button", { name: /continue with apple/i });

describe("LoginPage (Google-only)", () => {
  beforeEach(() => {
    loginWithGoogle.mockReset();
    nativeGoogleSignIn.mockReset();
    replace.mockReset();
    Object.assign(nativeState, { isNative: false, platform: "web" });
  });

  it("renders the Google sign-in button and brand", async () => {
    render(<LoginPage />);
    await waitFor(() => expect(getProviders).toHaveBeenCalled());
    expect(appleButton()).not.toBeInTheDocument(); // Apple not configured on the server
    expect(screen.getByText("PlayMatch")).toBeInTheDocument();
    expect(googleButton()).toBeInTheDocument();
    // No password fields in a Google-only flow
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });

  it("starts the Google flow on click and shows the pending state", async () => {
    let resolveSignIn!: () => void;
    const pending = new Promise<void>((res) => { resolveSignIn = res; });
    loginWithGoogle.mockReturnValue(pending);
    render(<LoginPage />);
    fireEvent.click(googleButton());
    expect(loginWithGoogle).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.getByRole("button", { name: /redirecting/i })).toBeDisabled());
    // Settle the pending promise and flush its continuation so nothing leaks.
    await act(async () => { resolveSignIn(); await pending; });
  });

  it("on the web never touches the native sign-in", async () => {
    loginWithGoogle.mockReturnValue(new Promise(() => {}));
    render(<LoginPage />);
    fireEvent.click(googleButton());
    expect(loginWithGoogle).toHaveBeenCalledOnce();
    expect(nativeGoogleSignIn).not.toHaveBeenCalled();
  });
});

describe("LoginPage inside the native app", () => {
  beforeEach(() => {
    loginWithGoogle.mockReset();
    nativeGoogleSignIn.mockReset();
    refreshProfile.mockClear();
    replace.mockReset();
    Object.assign(nativeState, { isNative: true, platform: "ios" });
  });

  it("runs native Google sign-in, refreshes the profile, and goes to the dashboard", async () => {
    nativeGoogleSignIn.mockResolvedValue({ userId: "u1", created: false, profileComplete: true });
    render(<LoginPage />);
    fireEvent.click(googleButton());
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
    expect(nativeGoogleSignIn).toHaveBeenCalledWith("ios");
    expect(refreshProfile).toHaveBeenCalled();
    expect(loginWithGoogle).not.toHaveBeenCalled();
  });

  it("explains when the app isn't configured for Google yet", async () => {
    const { NativeSignInError } = await import("@/lib/native-sign-in");
    nativeGoogleSignIn.mockRejectedValue(new NativeSignInError("not_configured"));
    render(<LoginPage />);
    fireEvent.click(googleButton());
    expect(await screen.findByText(/isn't set up for the app yet/i)).toBeInTheDocument();
    expect(googleButton()).not.toBeDisabled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("stays quiet when the user cancels", async () => {
    const { NativeSignInError } = await import("@/lib/native-sign-in");
    nativeGoogleSignIn.mockRejectedValue(new NativeSignInError("cancelled"));
    render(<LoginPage />);
    fireEvent.click(googleButton());
    await waitFor(() => expect(googleButton()).not.toBeDisabled());
    expect(screen.queryByText(/sign-in failed|isn't set up/i)).not.toBeInTheDocument();
  });

  it("shows a generic error for other failures", async () => {
    nativeGoogleSignIn.mockRejectedValue(new Error("boom"));
    nativeState.platform = "android";
    render(<LoginPage />);
    fireEvent.click(googleButton());
    expect(await screen.findByText(/sign-in failed/i)).toBeInTheDocument();
    expect(nativeGoogleSignIn).toHaveBeenCalledWith("android");
  });
});

describe("Sign in with Apple", () => {
  beforeEach(() => {
    nativeAppleSignIn.mockReset();
    nextAuthSignIn.mockReset();
    replace.mockReset();
    getProviders.mockResolvedValue({ google: {} });
    Object.assign(nativeState, { isNative: false, platform: "web" });
  });

  it("on the web, appears only when the server has the Apple provider, and uses Auth.js", async () => {
    getProviders.mockResolvedValue({ google: {}, apple: {} });
    nextAuthSignIn.mockReturnValue(new Promise(() => {}));
    render(<LoginPage />);
    await waitFor(() => expect(appleButton()).toBeInTheDocument());
    expect(screen.getByText(/sign in with apple or google/i)).toBeInTheDocument();
    fireEvent.click(appleButton()!);
    expect(nextAuthSignIn).toHaveBeenCalledWith("apple", { callbackUrl: "/dashboard" });
    expect(nativeAppleSignIn).not.toHaveBeenCalled();
  });

  it("in the iOS app, is shown first (above Google) and runs the native flow", async () => {
    Object.assign(nativeState, { isNative: true, platform: "ios" });
    nativeAppleSignIn.mockResolvedValue({ userId: "u1", created: true, profileComplete: false });
    render(<LoginPage />);
    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveAccessibleName(/continue with apple/i);
    expect(buttons[1]).toHaveAccessibleName(/continue with google/i);
    fireEvent.click(appleButton()!);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
    expect(nextAuthSignIn).not.toHaveBeenCalled();
  });

  it("explains when Apple isn't configured", async () => {
    Object.assign(nativeState, { isNative: true, platform: "ios" });
    const { NativeSignInError } = await import("@/lib/native-sign-in");
    nativeAppleSignIn.mockRejectedValue(new NativeSignInError("apple_not_configured"));
    render(<LoginPage />);
    fireEvent.click(appleButton()!);
    expect(await screen.findByText(/apple sign-in isn't set up for the app yet/i)).toBeInTheDocument();
  });

  it("is not offered in the Android app", async () => {
    Object.assign(nativeState, { isNative: true, platform: "android" });
    getProviders.mockResolvedValue({ google: {}, apple: {} });
    render(<LoginPage />);
    await waitFor(() => expect(getProviders).toHaveBeenCalled());
    expect(appleButton()).not.toBeInTheDocument();
  });
});
