import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // The workspace's parent has other projects; resolve this app independently.
  turbopack: { root: path.resolve(process.cwd()) },
};

export default nextConfig;
