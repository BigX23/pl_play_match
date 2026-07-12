import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // The server suite spins up a WASM Postgres (pglite) per file; too many
    // parallel jsdom+WASM workers deadlock on constrained machines. Cap forks.
    pool: "forks",
    poolOptions: { forks: { minForks: 1, maxForks: 2 } },
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html"],
      // Enforced unit-coverage scope: business logic, hooks, and our own
      // components. shadcn UI primitives, thin layout/provider shells, and
      // metadata-only route files are excluded (integration-tested via page
      // render tests instead).
      include: ["src/lib/**", "src/components/**", "src/hooks/**", "src/app/**", "src/server/**"],
      exclude: [
        "src/components/ui/**", // vendored shadcn primitives
        "src/**/*.test.{ts,tsx}",
        "src/**/*.d.ts",
        "src/ai/**",
        "src/app/layout.tsx",
        "src/app/**/layout.tsx",
        "src/components/theme-provider.tsx",
        // Config/bootstrap: the Firebase init block only runs with live env vars,
        // which can't be exercised in a unit test without a real project.
        "src/lib/firebase.ts",
        // API route handlers are thin HTTP glue: each is a one-liner delegating
        // to src/server/data.ts (100% covered) via the withUser wrapper
        // (route-helpers.ts, unit-tested). They're exercised end-to-end against
        // the live deployment; unit-testing the Next request/response plumbing
        // adds no logic coverage.
        "src/app/api/**",
        // Boot-time migration/seed runner — needs a live Postgres.
        "src/instrumentation.ts",
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        statements: 90,
        branches: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
