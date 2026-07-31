import type { NextConfig } from "next";

const supabaseInternalUrl =
  process.env.SUPABASE_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  basePath: "/app",
  // Next.js 15 streams metadata via AsyncMetadataOutlet for normal browsers.
  // That Suspense boundary can mismatch during hydration (React 19 + dev SSR).
  // Treat all user agents as HTML-limited so metadata is resolved before the page streams.
  htmlLimitedBots: /.*/,
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
