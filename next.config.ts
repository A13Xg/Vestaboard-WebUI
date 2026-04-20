import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure API secrets never leak to the client bundle
  serverExternalPackages: ["iron-session"],
  // Strict mode for better development warnings
  reactStrictMode: true,
};

export default nextConfig;
