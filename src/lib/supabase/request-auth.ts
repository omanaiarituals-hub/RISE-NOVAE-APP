import { createServerClient } from '@supabase/ssr'
import { createClient, type User } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'

type CookieToSet = {
  name: string
  value: string
  options?: any
}

export async function getRequestUser(request: NextRequest): Promise<User | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) return null

  const authHeader = request.headers.get('authorization')
  const bearerToken = authHeader?.replace(/^Bearer\s+/i, '').trim()
  if (bearerToken) {
    const bearerClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const {
      data: { user },
      error,
    } = await bearerClient.auth.getUser(bearerToken)
    return error ? null : user
  }

  const cookieStore = await cookies()
  const cookieClient = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }: CookieToSet) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Certains contextes serveur n’autorisent pas l’écriture de cookies.
        }
      },
    },
  })

  const {
    data: { user },
    error,
  } = await cookieClient.auth.getUser()
  return error ? null : user
}
