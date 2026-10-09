/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep production builds separate from a running development server.
  distDir: process.env.NODE_ENV === "production" ? ".next-production" : ".next",
  experimental: { cpus: 1 },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: { "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" } },
  },
};
export default nextConfig;
