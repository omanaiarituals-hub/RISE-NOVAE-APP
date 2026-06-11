/** @type {import('next').NextConfig} */

// ============================================================
// NOVAÉ — next.config.ts
// Mise à jour 12/06/2026 (audit) :
// 1. Headers de sécurité (C2) : X-Frame-Options, CSP, etc.
// 2. Landing servie en REWRITE et non plus en redirect 307 (I3)
//    → supprime un aller-retour réseau complet sur le domaine racine
// ============================================================

const securityHeaders = [
  {
    // Empêche l'app d'être affichée dans une iframe (clickjacking)
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    // Empêche le navigateur de "deviner" les types de fichiers
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    // Limite les infos envoyées aux sites externes lors d'un clic
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    // Désactive les API sensibles non utilisées par NOVAÉ
    key: 'Permissions-Policy',
    value: 'camera=(self), microphone=(self), geolocation=(), payment=()',
  },
  {
    // Content Security Policy adaptée à la stack NOVAÉ :
    // Supabase (data + auth), Stripe (checkout/portal), Google Fonts.
    // Si un service est ajouté plus tard (ex: analytics), l'ajouter ici.
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.supabase.co",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com",
      "frame-src https://js.stripe.com https://checkout.stripe.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self' https://checkout.stripe.com",
    ].join('; '),
  },
]

const nextConfig = {
  images: {
    domains: ['localhost'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },

  async headers() {
    return [
      {
        // Applique les headers de sécurité à toutes les routes
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },

  async rewrites() {
    return {
      beforeFiles: [
        // Landing servie directement sur la racine du domaine vitrine
        // (rewrite = même URL, pas de redirection, pas de 307)
        {
          source: '/',
          destination: '/landing.html',
          has: [{ type: 'host', value: 'novae-by-omanaia.com' }],
        },
        {
          source: '/',
          destination: '/landing.html',
          has: [{ type: 'host', value: 'www.novae-by-omanaia.com' }],
        },
      ],
    }
  },
}

export default nextConfig