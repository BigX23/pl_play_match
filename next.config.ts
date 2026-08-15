import path from 'path';
import type { NextConfig } from 'next';

/**
 * Next.js configuration
 * - Keeps your original TypeScript & ESLint build-ignore settings
 * - Adds a Webpack alias so "@/…" always resolves to "src/…"
 */
const nextConfig: NextConfig = {
  // ─── Server build for self-hosted VPS (Docker standalone) ───────────────────
  output: 'standalone',

  // Don't advertise the framework in an "x-powered-by" header. This reduces the
  // fingerprint mass scanners match on — though it is not a real control:
  // "Vary: RSC" and /_next/static/ paths still identify this as Next.js App
  // Router. Patch cadence is the defence; this just raises the noise floor.
  poweredByHeader: false,
  // trailingSlash removed with the static export: it 308-redirects API routes,
  // which breaks the exact-match OAuth callback URL. Old trailing-slash links
  // still resolve via Next's built-in redirect.

  // ─── Existing options ───────────────────────────────────────────────────────
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },

  images: {
    unoptimized: true,
    // remotePatterns for firebasestorage removed — Firebase was fully removed
    // from this stack; profile photos are served from /api/photos/[file].
    remotePatterns: [],
  },

  // ─── Redirect the old "Open Matches" route to "Open Games" (renamed) ────────
  async redirects() {
    return [
      { source: "/dashboard/open-matches", destination: "/dashboard/open-games", permanent: true },
    ];
  },

  // ─── Alias "@/…" → "<projectRoot>/src" ──────────────────────────────────────
  webpack: (config) => {
    // Ensure an alias object exists
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(__dirname, 'src'),
    };

    return config;
  },
};

export default nextConfig;
