import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@prisma/client', '.prisma/client'],
  // Existing clients use this prefix; the route is implemented locally by
  // Next.js/Prisma on Vercel and never proxies to an external server.
  env: {
    NEXT_PUBLIC_API_URL: '/api/backend',
  },
};

export default nextConfig;

// Opt in locally after a Hyperdrive development connection has been configured.
if (process.env.CLOUDFLARE_DEV === '1') initOpenNextCloudflareForDev();
