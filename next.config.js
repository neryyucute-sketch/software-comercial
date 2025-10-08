
const URL_API = process.env.URL_API;

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true, // ✅ importante para que las imágenes sirvan sin el loader de Next
  },
  experimental: {
    allowedDevOrigins: [URL_API],
  },

  // 👉 Para soportar export estático + SW cacheando páginas
  output: "export", // o "export" si quieres generar archivos estáticos 100%
};

module.exports = nextConfig;
