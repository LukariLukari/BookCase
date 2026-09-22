import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Client code only sees the same-origin gateway. BACKEND_API_URL remains a
  // server-side deployment secret and can be changed without rebuilding URLs
  // into every browser bundle.
  env: {
    NEXT_PUBLIC_API_URL: '/api/backend',
  },
};

export default nextConfig;
