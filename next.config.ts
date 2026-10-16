import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
    outputFileTracingRoot: path.join(__dirname),
  /* config options here */
  allowedDevOrigins: ["localhost",
    "100.125.65.69", "100.70.24.30", "msi-andrie"
  ],
};

export default nextConfig;