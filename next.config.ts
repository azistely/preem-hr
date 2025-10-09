import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Removed experimental.typedRoutes for Turbopack compatibility

  // Server components configuration
  serverExternalPackages: [
    '@react-pdf/renderer',
  ],

  // Webpack configuration (for production builds)
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('@react-pdf/renderer');
    }
    return config;
  },
};

export default nextConfig;
