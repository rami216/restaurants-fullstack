import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ❌ remove: output: "export"
  images: { unoptimized: true },

  // keep these to avoid blocking on lint/type issues
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  // ✅ ADD THIS SECTION TO FIX GOOGLE LOGIN
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
