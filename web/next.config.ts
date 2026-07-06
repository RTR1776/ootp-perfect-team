import type { NextConfig } from "next";
import path from "path";

const config: NextConfig = {
  // Pin the workspace root to this app dir; multiple lockfiles exist above it.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default config;
