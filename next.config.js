/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * Enable static HTML export so we can deploy to GitHub Pages.
   * Next.js will generate the site into the `out` directory.
   */
  output: 'export',

  /**
   * GitHub Pages serves the site from a sub-path for project pages,
   * e.g. `https://username.github.io/repo-name/`.
   *
   * Set `NEXT_PUBLIC_BASE_PATH` before building to match your repo name:
   *   NEXT_PUBLIC_BASE_PATH=/your-repo-name npm run deploy
   *
   * If you are using a custom domain or a user/organization page
   * (served from the root), you can leave this unset.
   */
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || '',

  /**
   * Static export does not support the default image optimizer,
   * so we disable it and let images be served as static files.
   */
  images: {
    unoptimized: true,
  },

  trailingSlash: true,
};

module.exports = nextConfig;

