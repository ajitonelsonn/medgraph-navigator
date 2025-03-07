// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ["arangojs"],
  experimental: {
    // Any other experimental options can remain here
  },
  webpack: (config, { isServer }) => {
    // Handle any Node.js specific modules for server-side
    if (isServer) {
    }

    return config;
  },
};

export default nextConfig;
