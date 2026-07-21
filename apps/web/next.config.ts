import type { NextConfig } from "next";

const supabaseInternalUrl =
  process.env.SUPABASE_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  basePath: "/app",
  transpilePackages: ["@rhodes/db", "@rhodes/shared"],
  serverExternalPackages: ["nodemailer"],
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
  async rewrites() {
    // Proxy browser Supabase traffic through Next.js so WebSocket upgrades
    // don't send oversized Cookie headers directly to Kong (HTTP 431).
    return [
      {
        source: "/supabase/:path*",
        destination: `${supabaseInternalUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
