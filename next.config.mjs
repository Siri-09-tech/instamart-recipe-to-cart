/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@modelcontextprotocol/sdk"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.swiggy.com" },
      { protocol: "https", hostname: "**.instamart.com" },
    ],
  },
};

export default nextConfig;
