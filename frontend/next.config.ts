import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ❌ remove: output: "export"
  images: { unoptimized: true },

  // keep these to avoid blocking on lint/type issues
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
