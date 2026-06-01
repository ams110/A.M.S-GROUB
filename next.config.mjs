/** @type {import('next').NextConfig} */

// On GitHub Pages a *project* site is served from a sub-path
// (https://<user>.github.io/<repo>/), so the app needs a basePath. The deploy
// workflow sets NEXT_PUBLIC_BASE_PATH from the Pages config; locally it's empty.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig = {
  // Produce a fully static site in ./out so it can be hosted on GitHub Pages.
  output: "export",
  // Static hosting can't run Next's image optimizer.
  images: { unoptimized: true },
  // Serve each route as <route>/index.html — friendlier for static hosts.
  trailingSlash: true,
  basePath,
  assetPrefix: basePath || undefined,
  // basePath isn't exposed to the browser by default; pass it through so client
  // code (e.g. links to /placeholder.svg) can prefix it when needed.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
