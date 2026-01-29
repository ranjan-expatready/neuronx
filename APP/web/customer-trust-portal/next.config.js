/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  },
  // Read-only portal - no server-side mutations
  poweredByHeader: false,
  reactStrictMode: true,
};

module.exports = nextConfig;
