import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { requireFinanceIdentity, financeUnauthorized, financeBadRequest } from '@/lib/finance/api'
import { supabaseAdmin } from '@/lib/supabase-admin'

type Context = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: Context) {
  const identity = await requireFinanceIdentity(request)
  if (!identity) return financeUnauthorized()
  const { id } = await context.params
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return financeBadRequest('Données invalides.')

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if ('custom_name' in body) {
    const value = String(body.custom_name ?? '').trim()
    patch.custom_name = value || null
  }
  if ('user_enabled' in body) patch.user_enabled = Boolean(body.user_enabled)

  if (!('custom_name' in body) && !('user_enabled' in body)) {
    return financeBadRequest('Aucune modification à appliquer.')
  }

  const { data, error } = await supabaseAdmin
    .from('finance_accounts')
    .update(patch)
    .eq('id', id)
    .eq('user_id', identity.id)
    .select('id,name,custom_name,is_active,user_enabled')
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'finance_account_update_failed', detail: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ account: data })
}

export async function DELETE(request: NextRequest, context: Context) {
  const identity = await requireFinanceIdentity(request)
  if (!identity) return financeUnauthorized()
  const { id } = await context.params

  // A bank account remains owned by the provider. "Delete" in NOVAÉ means
  // exclude it from calculations and analyses without destroying synchronized history.
  const { data, error } = await supabaseAdmin
    .from('finance_accounts')
    .update({ user_enabled: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', identity.id)
    .select('id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'finance_account_delete_failed', detail: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
