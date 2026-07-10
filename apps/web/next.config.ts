import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/app",
  transpilePackages: ["@rhodes/db", "@rhodes/shared"],
};

export default nextConfig;
