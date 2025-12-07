import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Removed experimental.typedRoutes for Turbopack compatibility

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

export default nextConfig;
