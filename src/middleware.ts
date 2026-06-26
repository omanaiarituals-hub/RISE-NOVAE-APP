import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ─── CRONS : bypass total du middleware ─────────────────────────────────────
  // Les crons Vercel n'ont pas de session utilisateur.
  // Ils s'authentifient via CRON_SECRET dans le header Authorization.
  // Le middleware ne doit pas les intercepter ni les rediriger vers /auth.
  if (pathname.startsWith('/api/cron/')) {
    return NextResponse.next()
  }
  // ────────────────────────────────────────────────────────────────────────────

  // ─── LANDING : apex → landing.html ──────────────────────────────────────────
  const host = request.headers.get('host') || ''
  const isApex = host === 'novae-by-omanaia.com' || host === 'www.novae-by-omanaia.com'
  const isRoot = pathname === '/'

  if (isApex && isRoot) {
    return NextResponse.rewrite(new URL('/landing.html', request.url))
  }
  // ────────────────────────────────────────────────────────────────────────────

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh la session si necessaire (synchronise les cookies)
  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    /*
     * Match toutes les routes sauf:
     * - _next/static (fichiers statiques)
     * - _next/image (images optimisees)
     * - favicon.ico
     * - sw.js, OneSignalSDKWorker.js, manifest.json (PWA files)
     * - les fichiers .svg, .png, .jpg
     * - /api/cron/* (crons Vercel — pas de session utilisateur)
     */
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|OneSignalSDKWorker\\.js|manifest\\.json|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}