import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components is off: every page reads the session cookie, so they all render per request,
  // and the previous caching model keeps that simple (no Suspense boundary around each auth check).
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
