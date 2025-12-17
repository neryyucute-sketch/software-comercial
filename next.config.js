
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

  // 👉 Para soportar export estático + SW cacheando páginas
  output: "export", // o "export" si quieres generar archivos estáticos 100%

  // 🔒 Seguridad: Headers de seguridad
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY', // Protección contra clickjacking
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff', // Evitar MIME sniffing
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block', // Protección XSS legacy
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self)', // Limitar APIs sensibles
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
