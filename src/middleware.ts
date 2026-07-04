import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // CORRECTIF SÉCURITÉ (audit 02/07/2026) :
  // L'ancienne condition `request.headers.get('stripe-signature') !== null`
  // permettait à N'IMPORTE QUELLE requête de contourner le middleware
  // simplement en ajoutant un header "stripe-signature: x".
  // Le webhook Stripe est déjà exclu par son chemin (/api/webhook), à la fois
  // ici et dans le matcher plus bas. Le webhook vérifie de toute façon la
  // vraie signature Stripe dans sa route. Le bypass par header est supprimé.
  if (pathname.startsWith('/api/cron/') || pathname === '/api/webhook') {
    return NextResponse.next()
  }

  const host = request.headers.get('host') || ''
  const isApex = host === 'novae-by-omanaia.com' || host === 'www.novae-by-omanaia.com'
  const isRoot = pathname === '/'

  if (isApex && isRoot) {
    return NextResponse.rewrite(new URL('/landing.html', request.url))
  }

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

  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|OneSignalSDKWorker\\.js|manifest\\.json|api/cron|api/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
