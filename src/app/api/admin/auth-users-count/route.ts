import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAILS = ['nesserinesediri@gmail.com', 'omanaiarituals@gmail.com']
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return NextResponse.json({ error: 'SERVICE_ROLE_KEY manquante' }, { status: 500 })

  // Vérifie admin
  const authClient = createClient(url, anonKey, { auth: { persistSession: false } })
  const { data: { user } } = await authClient.auth.getUser(token)
  if (!user?.email || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  // Liste les auth users via service role
  const adminClient = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data, error } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ total: data.users.length })
}