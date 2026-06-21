/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  // Allow large PDF data URLs through server actions / API bodies.
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
  },
  async headers() {
    // Send no-store on app HTML routes so users never get a stale app shell
    // after a Vercel deploy. Exclude _next assets and api routes.
    return [
      {
        source: "/((?!_next/|api/).*)",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
    ];
  },
};

module.exports = nextConfig;
