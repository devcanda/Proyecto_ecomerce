import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La tienda usa rutas en español; los enlaces antiguos en ingles redirigen a la nueva ruta
  async redirects() {
    return [
      { source: "/products", destination: "/productos", permanent: true },
      { source: "/products/:slug", destination: "/productos/:slug", permanent: true },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

export default nextConfig;
