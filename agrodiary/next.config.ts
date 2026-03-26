import type { NextConfig } from "next";
import { resolve } from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  allowedDevOrigins: ["fran.tail708413.ts.net"],
  serverExternalPackages: [
    "better-sqlite3",
    "pdf-parse",
    "xlsx",
    "mammoth",
    "word-extractor",
  ],
  turbopack: {
    root: resolve(__dirname),
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
