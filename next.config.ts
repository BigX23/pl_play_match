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
  // Kept from the static-export era so existing trailing-slash links keep working.
  trailingSlash: true,

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
