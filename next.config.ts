import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";
import { runtimeCaching } from "@ducanh2912/next-pwa";

const navigationCacheNames = new Set(["start-url", "apis", "next-data", "pages-rsc-prefetch", "pages-rsc", "pages"]);

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  cacheStartUrl: false,
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,
  reloadOnOnline: true,
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: runtimeCaching.filter((entry) => !navigationCacheNames.has(entry.options?.cacheName ?? "")),
  },
});

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/:path(workbox-.*\\.js)",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate" },
        ],
      },
      {
        source: "/manifest.json",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate" },
        ],
      },
      {
        source: "/:path(.*\\.(?:png|jpg|jpeg|webp|avif|svg|ico|woff|woff2))",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "zod"],
  },
  allowedDevOrigins: [
    "192.168.1.3",
    "192.168.1.3:3000",
    "http://192.168.1.3:3000",
    "192.168.1.7",
    "192.168.1.7:3000",
    "http://192.168.1.7:3000",
    "192.168.1.4",
    "192.168.1.4:3000",
    "http://192.168.1.4:3000",
    "localhost",
    "localhost:3000",
    "127.0.0.1",
    "127.0.0.1:3000",
  ],
};

export default withPWA(nextConfig);
