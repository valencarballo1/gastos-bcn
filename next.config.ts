import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // Casa Clara's shared frontend contract names this variable VITE_API_URL.
    // Expose it explicitly because this project is built with Next.js.
    VITE_API_URL: process.env.VITE_API_URL,
    VITE_AUTH_DEBUG: process.env.VITE_AUTH_DEBUG,
  },
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
