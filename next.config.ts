import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // jsdom loads files at runtime and must not be bundled
  serverExternalPackages: ["jsdom"],
};

export default nextConfig;
