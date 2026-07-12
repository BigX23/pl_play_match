"use client";

import LoginPage from "@/app/login/page";

/**
 * Registration and sign-in are the same Google flow — new users get a
 * profile row automatically and are routed to onboarding.
 */
export default function RegisterPage() {
  return <LoginPage />;
}
