import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { financeUnauthorized, requireFinanceIdentity } from '@/lib/finance/api'

export async function GET(request:NextRequest){
  const identity=await requireFinanceIdentity(request); if(!identity)return financeUnauthorized()
  const since=new Date(Date.now()-1000*60*60*24*100).toISOString()
  const [envelopes,movements]=await Promise.all([
    supabaseAdmin.from('finance_envelopes').select('id,name,target_amount').eq('user_id',identity.id).eq('is_active',true),
    supabaseAdmin.from('finance_envelope_movements').select('envelope_id,amount,movement_type,created_at').eq('user_id',identity.id).eq('movement_type','adjustment').gte('created_at',since),
  ])
  const error=envelopes.error||movements.error; if(error)return NextResponse.json({error:'finance_recalibration_failed',detail:error.message},{status:500})
  const suggestions=(envelopes.data??[]).flatMap((envelope)=>{ const positive=(movements.data??[]).filter(m=>m.envelope_id===envelope.id&&Number(m.amount)>0); if(positive.length<2)return[]; const avg=positive.reduce((s,m)=>s+Number(m.amount),0)/positive.length; const target=Number(envelope.target_amount||0); return [{envelope_id:envelope.id,name:envelope.name,current_target:target,suggested_target:Math.round((target+avg)/10)*10,adjustments_count:positive.length,average_extra:Math.round(avg*100)/100,reason:`Tu as ajouté de l’argent ${positive.length} fois récemment. Nova te propose d’intégrer une partie de cet écart au budget de référence.`}] })
  return NextResponse.json({suggestions})
}
