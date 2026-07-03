/** @type {import('next').NextConfig} */
const path = require("path");

const nextConfig = {
  output: "standalone",
  ...(process.env.DOCKER_BUILD
    ? {}
    : { outputFileTracingRoot: path.join(__dirname, "../..") }),
  async rewrites() {
    const apiUrl = process.env.INTERNAL_API_URL || "http://api:8000";
    return [
      {
        source: "/api/backend/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
