import type { NextConfig } from "next";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  // Enable sourcemaps for error tracking (Sonarly)
  productionBrowserSourceMaps: true,

  // Server components configuration
  serverExternalPackages: [
    '@react-pdf/renderer',
  ],

  // Turbopack configuration (Next.js 16+ default)
  turbopack: {},

  // Webpack configuration (for production builds when using --webpack flag)
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('@react-pdf/renderer');
    }
    return config;
  },
};

export default withBundleAnalyzer(nextConfig);
