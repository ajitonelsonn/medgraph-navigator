// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    serverComponentsExternalPackages: ["arangojs"],
  },
  webpack: (config, { isServer }) => {
    // Handle any Node.js specific modules for server-side
    if (isServer) {
      // Add any server-specific optimizations if needed
    }

    return config;
  },
};

export default nextConfig;
