import { NextResponse, type NextRequest } from 'next/server'
import { requireFinanceIdentity, financeUnauthorized } from '@/lib/finance/api'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request: NextRequest) {
  const identity = await requireFinanceIdentity(request)
  if (!identity) return financeUnauthorized()

  const today = new Date().toISOString().slice(0, 10)

  const { data, error } = await supabaseAdmin
    .from('finance_recurring_commitments')
    .select('id,name,amount,next_due_date,commitment_type,source')
    .eq('user_id', identity.id)
    .eq('is_active', true)
    .gte('next_due_date', today)
    .order('next_due_date', { ascending: true })
    .limit(3)

  if (error) {
    return NextResponse.json({ error: 'upcoming_preview_failed', detail: error.message }, { status: 500 })
  }

  return NextResponse.json({ items: data || [] })
}
