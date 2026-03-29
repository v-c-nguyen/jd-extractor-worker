import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [],
  serverExternalPackages: ["googleapis", "playwright"],
};

export default nextConfig;
