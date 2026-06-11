import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,
  eslint: {
    dirs: ['src', 'tests', 'scripts']
  },
  experimental: {
    optimizePackageImports: ['antd', '@iconify-icon/react']
  },
  staticPageGenerationTimeout: 120
};

export default nextConfig;
