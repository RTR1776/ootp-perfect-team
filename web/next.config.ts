import type { NextConfig } from "next";
import path from "path";

const config: NextConfig = {
  // Claude's sandbox cannot delete inside .next, so a build from there goes
  // to a fresh directory: NEXT_DIST_DIR=.next-check npx next build
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
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
