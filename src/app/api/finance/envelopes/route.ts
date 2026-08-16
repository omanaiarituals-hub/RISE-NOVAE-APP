import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { financeBadRequest, financeUnauthorized, integerOr, numberOrNull, requireFinanceIdentity } from '@/lib/finance/api'

const modes = new Set(['spend','accumulate','repay'])
function structuralType(mode:string){ return mode==='repay'?'debt':mode==='accumulate'?'cumulative':'monthly' }

export async function GET(request:NextRequest){
  const identity=await requireFinanceIdentity(request); if(!identity)return financeUnauthorized()
  const {data,error}=await supabaseAdmin.from('finance_envelopes').select('id,name,envelope_type,tracking_mode,target_amount,current_amount,cash_balance,carryover_amount,rollover_enabled,cash_enabled,priority,is_active,created_at,updated_at').eq('user_id',identity.id).eq('is_active',true).order('priority',{ascending:true}).order('created_at',{ascending:true})
  if(error)return NextResponse.json({error:'finance_envelopes_unavailable',detail:error.message},{status:500})
  return NextResponse.json({envelopes:data??[]})
}

export async function POST(request:NextRequest){
  const identity=await requireFinanceIdentity(request); if(!identity)return financeUnauthorized()
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null; if(!body)return financeBadRequest('Données invalides.')
  const name=String(body.name??'').trim(), mode=String(body.tracking_mode??'spend'), target=numberOrNull(body.target_amount), current=numberOrNull(body.current_amount)??0
  if(!name)return financeBadRequest('Le nom est obligatoire.'); if(!modes.has(mode))return financeBadRequest('Mode de suivi invalide.'); if(target===null||target<0||current<0)return financeBadRequest('Montants invalides.')
  const {data,error}=await supabaseAdmin.from('finance_envelopes').insert({user_id:identity.id,name,envelope_type:structuralType(mode),tracking_mode:mode,target_amount:target,current_amount:current,cash_balance:0,carryover_amount:0,rollover_enabled:Boolean(body.rollover_enabled),cash_enabled:Boolean(body.cash_enabled),priority:integerOr(body.priority,100),is_active:true}).select('id,name,envelope_type,tracking_mode,target_amount,current_amount,cash_balance,carryover_amount,rollover_enabled,cash_enabled,priority,is_active,created_at,updated_at').single()
  if(error)return NextResponse.json({error:'finance_envelope_create_failed',detail:error.message},{status:500}); return NextResponse.json({envelope:data},{status:201})
}
