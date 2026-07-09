import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  deleteUser,
  type User,
} from "firebase/auth";
import { auth, isFirebaseConfigured } from "./firebase";

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle(): Promise<User> {
  if (!isFirebaseConfigured || !auth) throw new Error("Firebase not configured");
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  if (!isFirebaseConfigured || !auth) throw new Error("Firebase not configured");
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function registerWithEmail(email: string, password: string): Promise<User> {
  if (!isFirebaseConfigured || !auth) throw new Error("Firebase not configured");
  const result = await createUserWithEmailAndPassword(auth, email, password);
  await sendEmailVerification(result.user);
  return result.user;
}

export async function signOut(): Promise<void> {
  if (!isFirebaseConfigured || !auth) return;
  await firebaseSignOut(auth);
}

export async function resetPassword(email: string): Promise<void> {
  if (!isFirebaseConfigured || !auth) throw new Error("Firebase not configured");
  await sendPasswordResetEmail(auth, email);
}

export async function deleteAccount(): Promise<void> {
  if (!isFirebaseConfigured || !auth) return;
  const current = auth.currentUser;
  if (current) await deleteUser(current);
}

/** Map a Firebase auth error to a human-friendly message. */
export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code || "";
  switch (code) {
    case "auth/invalid-email":
      return "That email address looks invalid.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/email-already-in-use":
      return "An account with that email already exists.";
    case "auth/weak-password":
      return "Please choose a stronger password (at least 6 characters).";
    case "auth/popup-closed-by-user":
      return "Sign-in was cancelled.";
    case "auth/network-request-failed":
      return "Network error — check your connection and try again.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}
