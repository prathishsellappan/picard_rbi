import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

// Dev only: other devices on the same network open this computer's network address (e.g.
// http://10.42.81.56:3000; see `npm run local:lan`). Next.js blocks its dev resources for any host
// other than localhost unless the host is listed here, so the page would load but its buttons
// wouldn't work. The list is this computer's own IPv4 addresses, read at server start.
const lanHosts = Object.values(networkInterfaces())
  .flat()
  .filter((a) => a && a.family === "IPv4" && !a.internal)
  .map((a) => a!.address);

const nextConfig: NextConfig = {
  // Cache Components is off: every page reads the session cookie, so they all render per request,
  // and the previous caching model keeps that simple (no Suspense boundary around each auth check).
  allowedDevOrigins: ["127.0.0.1", ...lanHosts],
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
