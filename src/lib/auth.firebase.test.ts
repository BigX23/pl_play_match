import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("./firebase", () => ({ isFirebaseConfigured: true, auth: { currentUser: null } }));

const signInWithPopup = vi.fn();
const signInWithEmailAndPassword = vi.fn();
const createUserWithEmailAndPassword = vi.fn();
const firebaseSignOut = vi.fn();
const sendPasswordResetEmail = vi.fn();
const sendEmailVerification = vi.fn();
const deleteUser = vi.fn();

vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class {},
  signInWithPopup: (...a: unknown[]) => signInWithPopup(...a),
  signInWithEmailAndPassword: (...a: unknown[]) => signInWithEmailAndPassword(...a),
  createUserWithEmailAndPassword: (...a: unknown[]) => createUserWithEmailAndPassword(...a),
  signOut: (...a: unknown[]) => firebaseSignOut(...a),
  sendPasswordResetEmail: (...a: unknown[]) => sendPasswordResetEmail(...a),
  sendEmailVerification: (...a: unknown[]) => sendEmailVerification(...a),
  deleteUser: (...a: unknown[]) => deleteUser(...a),
}));

import * as auth from "./auth";
import { auth as fakeAuth } from "./firebase";

beforeEach(() => {
  vi.clearAllMocks();
  (fakeAuth as { currentUser: unknown }).currentUser = null;
});

describe("auth.ts Firebase path", () => {
  it("signInWithGoogle returns the user", async () => {
    signInWithPopup.mockResolvedValue({ user: { uid: "g1" } });
    const u = await auth.signInWithGoogle();
    expect(u).toEqual({ uid: "g1" });
    expect(signInWithPopup).toHaveBeenCalledWith(fakeAuth, expect.anything());
  });

  it("signInWithEmail returns the user", async () => {
    signInWithEmailAndPassword.mockResolvedValue({ user: { uid: "e1" } });
    const u = await auth.signInWithEmail("a@b.c", "pw");
    expect(u).toEqual({ uid: "e1" });
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(fakeAuth, "a@b.c", "pw");
  });

  it("registerWithEmail creates user and sends verification email", async () => {
    createUserWithEmailAndPassword.mockResolvedValue({ user: { uid: "r1" } });
    sendEmailVerification.mockResolvedValue(undefined);
    const u = await auth.registerWithEmail("a@b.c", "pw");
    expect(u).toEqual({ uid: "r1" });
    expect(sendEmailVerification).toHaveBeenCalledWith({ uid: "r1" });
  });

  it("signOut calls firebase signOut", async () => {
    firebaseSignOut.mockResolvedValue(undefined);
    await auth.signOut();
    expect(firebaseSignOut).toHaveBeenCalledWith(fakeAuth);
  });

  it("resetPassword sends reset email", async () => {
    sendPasswordResetEmail.mockResolvedValue(undefined);
    await auth.resetPassword("a@b.c");
    expect(sendPasswordResetEmail).toHaveBeenCalledWith(fakeAuth, "a@b.c");
  });

  it("deleteAccount deletes current user when present", async () => {
    (fakeAuth as { currentUser: unknown }).currentUser = { uid: "d1" };
    deleteUser.mockResolvedValue(undefined);
    await auth.deleteAccount();
    expect(deleteUser).toHaveBeenCalledWith({ uid: "d1" });
  });

  it("deleteAccount is a no-op when no current user", async () => {
    (fakeAuth as { currentUser: unknown }).currentUser = null;
    await auth.deleteAccount();
    expect(deleteUser).not.toHaveBeenCalled();
  });
});

describe("authErrorMessage mapping", () => {
  const cases: Array<[string, string]> = [
    ["auth/invalid-email", "That email address looks invalid."],
    ["auth/user-disabled", "This account has been disabled."],
    ["auth/user-not-found", "Incorrect email or password."],
    ["auth/wrong-password", "Incorrect email or password."],
    ["auth/invalid-credential", "Incorrect email or password."],
    ["auth/email-already-in-use", "An account with that email already exists."],
    ["auth/weak-password", "Please choose a stronger password (at least 6 characters)."],
    ["auth/popup-closed-by-user", "Sign-in was cancelled."],
    ["auth/network-request-failed", "Network error — check your connection and try again."],
    ["auth/too-many-requests", "Too many attempts. Please wait a moment and try again."],
    ["something-else", "Something went wrong. Please try again."],
  ];
  it.each(cases)("maps %s", (code, expected) => {
    expect(auth.authErrorMessage({ code })).toBe(expected);
  });

  it("handles a non-object error", () => {
    expect(auth.authErrorMessage(null)).toBe("Something went wrong. Please try again.");
    expect(auth.authErrorMessage("boom")).toBe("Something went wrong. Please try again.");
  });
});
