/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  poweredByHeader: false,
  reactStrictMode: true,
  agentRules: false,
  images: { unoptimized: true },
};
export default nextConfig;
