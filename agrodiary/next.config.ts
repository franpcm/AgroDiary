import type { NextConfig } from "next";

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
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
