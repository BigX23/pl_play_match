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
  // ─── Webpack configuration for path aliases ───────────────────────────────
  webpack: (config, { isServer }) => {
    config.resolve.alias['@'] = path.join(__dirname, 'src');
    return config;
  },
};

export default nextConfig;
