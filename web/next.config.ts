import type { NextConfig } from "next";
import path from "path";

const config: NextConfig = {
  // Pin the workspace root to this app dir; multiple lockfiles exist above it.
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Old v1 routes (retired 2026-08-27) land on the builder.
  async redirects() {
    return ["/tournaments", "/lineup", "/roster", "/draft", "/lab"].map((source) => ({
      source,
      destination: "/build",
      permanent: false,
    })).concat([{ source: "/card/:path*", destination: "/build", permanent: false }]);
  },
};

export default config;
