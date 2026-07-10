import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/app",
  transpilePackages: ["@rhodes/db", "@rhodes/shared"],
  async redirects() {
    return [
      {
        source: "/",
        destination: "/app",
        basePath: false,
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
