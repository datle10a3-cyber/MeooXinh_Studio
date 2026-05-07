import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
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

export default nextConfig;
