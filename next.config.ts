import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Paquete autonomo (carpeta .next/standalone) para subirlo al hosting ya construido
  output: "standalone",
  // Permite abrir el servidor de desarrollo desde otros equipos de la red (por IP)
  allowedDevOrigins: ["192.168.52.237", "26.209.119.170"],
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
