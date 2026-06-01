/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static HTML export so the app can be hosted on GitHub Pages (no Node server).
  output: "export",
  // Project page is served from https://<user>.github.io/Tiandy-store
  basePath: "/Tiandy-store",
  trailingSlash: true,
  images: {
    unoptimized: true,
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
