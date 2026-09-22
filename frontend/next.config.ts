import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Existing clients use this prefix; the route is implemented locally by
  // Next.js/Prisma on Vercel and never proxies to an external server.
  env: {
    NEXT_PUBLIC_API_URL: '/api/backend',
  },
};

export default nextConfig;
