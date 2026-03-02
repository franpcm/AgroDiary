import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
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
