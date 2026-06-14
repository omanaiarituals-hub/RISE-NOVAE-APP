import type { NextConfig } from 'next'

  // ─── HEADERS SÉCURITÉ ───────────────────────────────────────────────────────
 const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://cdn.jsdelivr.net",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com",
              "connect-src 'self' https://*.supabase.co https://api.anthropic.com https://api.stripe.com https://api.brevo.com https://app.novae-by-omanaia.com wss://*.supabase.co",
              "frame-src https://js.stripe.com",
              "worker-src 'self' blob:",
            ].join('; '),
          },
        ],
      },
    ]
  },

  async rewrites() {
    return [
      {
        source: '/',
        has: [{ type: 'host', value: 'novae-by-omanaia.com' }],
        destination: '/landing.html',
      },
    ]
  },

  // ─── IMAGES ──────────────────────────────────────────────────────────────────
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },

  poweredByHeader: false,
}

export default nextConfig