import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { type Analytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);

// Loud failure in production: a prod build missing Firebase config would
// silently fall back to mock localStorage auth that accepts any password.
// Surface it instead of shipping a fake-auth app.
if (
  !isFirebaseConfigured &&
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PUBLIC_ALLOW_MOCK !== "true"
) {
  const msg =
    "[PlayMatch] Firebase is not configured in a production build. Set NEXT_PUBLIC_FIREBASE_* env vars, or set NEXT_PUBLIC_ALLOW_MOCK=true to intentionally run in mock mode.";
  if (typeof window === "undefined") {
    // Fail the build/server render so a misconfiguration can't ship unnoticed.
    throw new Error(msg);
  } else {
    console.error(msg);
  }
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;
let analytics: Analytics | null = null;

if (isFirebaseConfigured) {
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);

  // Analytics only on client side, and only where actually supported.
  if (typeof window !== "undefined" && firebaseConfig.measurementId) {
    import("firebase/analytics")
      .then(({ getAnalytics, isSupported }) =>
        isSupported().then((ok) => {
          if (ok) analytics = getAnalytics(app!);
        })
      )
      .catch((err) => console.warn("[PlayMatch] Analytics unavailable:", err));
  }
} else {
  if (typeof window !== "undefined") {
    console.warn("[PlayMatch] Firebase not configured — running in mock mode");
  }
}

export { app, auth, db, storage, analytics };
