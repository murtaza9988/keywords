import type { NextConfig } from "next";

const backendOrigin =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, "") ||
  process.env.API_URL?.replace(/\/api\/?$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    if (!backendOrigin) {
      return [];
    }
    return [
      {
        source: "/api/:path*",
        destination: `${backendOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
