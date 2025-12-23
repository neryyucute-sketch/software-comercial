
const URL_API = process.env.URL_API;

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false, // 🔒 Seguridad: No ignorar errores de TypeScript
  },
  images: {
    unoptimized: true, // ✅ importante para que las imágenes sirvan sin el loader de Next
  },
  experimental: {
    allowedDevOrigins: [URL_API],
  },

  // En server runtime no usamos export estático; Next.js sirve con "next start"
  // Si en algún entorno se requiere export estático, habilitar "output: 'export'" explícitamente allí.
  // Headers no se aplican en export estático; configúralos en CDN/servidor si los necesitas
};

module.exports = nextConfig;
