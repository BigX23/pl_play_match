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
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "*.firebasestorage.app",
      },
    ],
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
