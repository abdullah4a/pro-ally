import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist (via pdf-parse) resolves its worker file relative to its own
  // package location at runtime. Bundling it breaks that resolution — Turbopack
  // rewrites the import to a .next chunk path that the worker file was never
  // copied to, so keep it as a native Node require instead.
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
