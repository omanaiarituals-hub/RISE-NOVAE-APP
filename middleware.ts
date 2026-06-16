import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// =============================================================
// NOVAÉ — Middleware d'authentification
// Role unique : rafraichir la session Supabase a chaque
// navigation et reecrire le cookie a jour, pour eviter les
// deconnexions intempestives (surtout sur mobile / PWA).
// Recommandation officielle @supabase/ssr.
// =============================================================

export async function middleware(request: NextRequest) {
  // Reponse de base : on la mute au fil des cookies a reecrire
  let supabaseResponse = NextResponse.next({
    request,
  })

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
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT : getUser() declenche le refresh du token si besoin
  // et ecrit le nouveau cookie via setAll ci-dessus.
  // Ne RIEN faire entre createServerClient et getUser.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Pages publiques : pas de redirection meme sans session
  const publicPaths = [
    '/auth',
    '/login',
    '/signup',
    '/blog',
    '/cgu',
    '/confidentialite',
    '/reset-password',
    '/update-password',
  ]
  const { pathname } = request.nextUrl
  const isPublic =
    pathname === '/' ||
    publicPaths.some((p) => pathname === p || pathname.startsWith(p + '/'))

  // Utilisatrice non connectee sur une page protegee -> /auth
  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  // IMPORTANT : toujours renvoyer supabaseResponse pour conserver
  // les cookies rafraichis. Ne pas creer une nouvelle reponse ici.
  return supabaseResponse
}

export const config = {
  // On exclut les assets statiques et fichiers du dossier public.
  // Ainsi le middleware ne tourne que sur les vraies pages/navigations.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|favicon-16x16.png|favicon-32x32.png|apple-touch-icon.png|icon-192.png|icon-512.png|manifest.json|sw.js|robots.txt|sitemap.xml|sitemap-app.xml|og-cover.jpg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}