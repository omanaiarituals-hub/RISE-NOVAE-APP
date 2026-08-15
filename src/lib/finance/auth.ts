import type { NextRequest } from 'next/server'
import { getRequestUser } from '@/lib/supabase/request-auth'
import { createClient } from '@/lib/supabase/server'

export type FinanceIdentity = {
  id: string
  source: 'supabase' | 'dev-preview'
}

function previewUserId() {
  if (process.env.NODE_ENV === 'production') return null
  if (process.env.FINANCE_DEV_PREVIEW !== 'true') return null
  const value = process.env.FINANCE_DEV_PREVIEW_USER_ID?.trim()
  return value || null
}

export async function getFinanceRequestIdentity(request: NextRequest): Promise<FinanceIdentity | null> {
  const user = await getRequestUser(request)
  if (user) return { id: user.id, source: 'supabase' }

  const fallback = previewUserId()
  return fallback ? { id: fallback, source: 'dev-preview' } : null
}

export async function getFinanceServerIdentity(): Promise<FinanceIdentity | null> {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (!error && user) return { id: user.id, source: 'supabase' }
  } catch {
    // Le fallback local ci-dessous est volontairement limité au dev preview.
  }

  const fallback = previewUserId()
  return fallback ? { id: fallback, source: 'dev-preview' } : null
}
