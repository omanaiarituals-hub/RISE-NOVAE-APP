/** @type {import('next').NextConfig} */
const nextConfig = {
  // ─── HEADERS SÉCURITÉ ───────────────────────────────────────────────────────
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(self), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://cdn.jsdelivr.net",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com",
              "connect-src 'self' https://*.supabase.co https://api.anthropic.com https://api.stripe.com https://api.brevo.com wss://*.supabase.co",
              "frame-src https://js.stripe.com",
              "worker-src 'self' blob:",
            ].join('; '),
          },
        ],
      },
    ]
  },

  // ─── REDIRECTS ───────────────────────────────────────────────────────────────
  // Supprime le redirect 307 lent vers /landing.html
  // La landing doit être directement dans app/page.tsx ou app/landing/page.tsx
  async redirects() {
    return [
      // Si tu avais un ancien redirect vers /landing.html, on le supprime
      // en redirigeant directement vers la racine
      {
        source: '/landing.html',
        destination: '/',
        permanent: true, // 308 → mis en cache par le navigateur, plus rapide
      },
      {
        source: '/landing',
        destination: '/',
        permanent: true,
      },
    ]
  },

  // ─── IMAGES ──────────────────────────────────────────────────────────────────
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },

  // ─── DIVERS ──────────────────────────────────────────────────────────────────
  poweredByHeader: false, // supprime le header "X-Powered-By: Next.js"
}

module.exports = nextConfig