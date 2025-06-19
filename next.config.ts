import path from 'path';
import type { NextConfig } from 'next';

/**
 * Next.js configuration
 * - Keeps your original TypeScript & ESLint build-ignore settings
 * - Adds a Webpack alias so "@/…" always resolves to "src/…"
 */
const nextConfig: NextConfig = {
  // ─── Existing options ───────────────────────────────────────────────────────
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
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
