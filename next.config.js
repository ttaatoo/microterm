/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

const nextConfig = {
  // Only use static export for production builds
  ...(isProd && {
    output: "export",
    distDir: "out",
  }),
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
