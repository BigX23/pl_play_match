import { describe, it, expect } from "vitest";
import { isFirebaseConfigured, auth, db } from "./firebase";

// In the test env no NEXT_PUBLIC_FIREBASE_* vars are set and NODE_ENV is
// "test", so the module-level logic must resolve to unconfigured mock mode
// without throwing.
describe("firebase.ts module-level config", () => {
  it("isFirebaseConfigured is false when env is unset", () => {
    expect(isFirebaseConfigured).toBe(false);
  });

  it("auth and db are null in mock mode", () => {
    expect(auth).toBeNull();
    expect(db).toBeNull();
  });
});
