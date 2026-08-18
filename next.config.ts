import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      {
        source: "/foretag/proffera-test",
        destination: "/foretag/iboren",
        permanent: true,
      },
      {
        source: "/foretag/proffera-test/:path*",
        destination: "/foretag/iboren/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
