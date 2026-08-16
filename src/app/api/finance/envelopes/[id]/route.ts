import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { financeBadRequest, financeUnauthorized, integerOr, numberOrNull, requireFinanceIdentity } from '@/lib/finance/api'
const modes=new Set(['spend','accumulate','repay']); type Context={params:Promise<{id:string}>}
function structuralType(mode:string){return mode==='repay'?'debt':mode==='accumulate'?'cumulative':'monthly'}
export async function GET(request:NextRequest,context:Context){
  const identity=await requireFinanceIdentity(request);if(!identity)return financeUnauthorized();const{id}=await context.params
  const yearStart=`${new Date().getFullYear()}-01-01`
  const[{data,error},{data:movements,error:movementError},{data:snapshots,error:snapshotError}]=await Promise.all([
    supabaseAdmin.from('finance_envelopes').select('id,name,envelope_type,tracking_mode,target_amount,current_amount,cash_balance,carryover_amount,rollover_enabled,cash_enabled,priority,is_active,created_at,updated_at').eq('id',id).eq('user_id',identity.id).maybeSingle(),
    supabaseAdmin.from('finance_envelope_movements').select('movement_type,amount,occurred_on,metadata').eq('user_id',identity.id).eq('envelope_id',id).gte('occurred_on',yearStart),
    supabaseAdmin.from('finance_envelope_cycle_snapshots').select('spent_amount,injected_amount,withdrawn_amount,transferred_to_savings_amount').eq('user_id',identity.id).eq('envelope_id',id).gte('cycle_end',yearStart),
  ])
  if(error)return NextResponse.json({error:'finance_envelope_unavailable',detail:error.message},{status:500});if(!data)return NextResponse.json({error:'Not found'},{status:404})
  if(movementError)return NextResponse.json({error:'finance_envelope_movements_unavailable',detail:movementError.message},{status:500})
  if(snapshotError)return NextResponse.json({error:'finance_envelope_snapshots_unavailable',detail:snapshotError.message},{status:500})
  let spent=0,injected=0,withdrawn=0,remainderSaved=0
  for(const row of snapshots??[])remainderSaved+=Number(row.transferred_to_savings_amount||0)
  for(const row of movements??[]){
    const amount=Number(row.amount||0),semantic=String((row.metadata as any)?.semantic||'')
    if(data.tracking_mode==='spend'){
      if(row.movement_type==='expense')spent+=Math.abs(amount)
      if(row.movement_type==='adjustment'&&semantic!=='cash_balance')spent+=amount
    }else{
      if(row.movement_type==='cash_deposit')injected+=Math.abs(amount)
      if(row.movement_type==='adjustment'&&amount>0&&semantic!=='cash_balance')injected+=Math.abs(amount)
      if((row.movement_type==='expense'||row.movement_type==='adjustment')&&amount<0&&semantic!=='cash_balance')withdrawn+=Math.abs(amount)
    }
  }
  return NextResponse.json({envelope:{...data,year_stats:{spent,injected,withdrawn,remainder_saved:remainderSaved}}})
}
export async function PATCH(request:NextRequest,context:Context){const identity=await requireFinanceIdentity(request);if(!identity)return financeUnauthorized();const{id}=await context.params;const body=await request.json().catch(()=>null) as Record<string,unknown>|null;if(!body)return financeBadRequest('Données invalides.');const patch:Record<string,unknown>={updated_at:new Date().toISOString()};if('name'in body){const n=String(body.name??'').trim();if(!n)return financeBadRequest('Nom obligatoire.');patch.name=n}if('tracking_mode'in body){const m=String(body.tracking_mode);if(!modes.has(m))return financeBadRequest('Mode invalide.');patch.tracking_mode=m;patch.envelope_type=structuralType(m)}if('target_amount'in body){const v=numberOrNull(body.target_amount);if(v===null||v<0)return financeBadRequest('Montant prévu invalide.');patch.target_amount=v}if('current_amount'in body){const v=numberOrNull(body.current_amount);if(v===null||v<0)return financeBadRequest('Montant courant invalide.');patch.current_amount=v}if('rollover_enabled'in body)patch.rollover_enabled=Boolean(body.rollover_enabled);if('cash_enabled'in body)patch.cash_enabled=Boolean(body.cash_enabled);if('priority'in body)patch.priority=integerOr(body.priority,100);const{data,error}=await supabaseAdmin.from('finance_envelopes').update(patch).eq('id',id).eq('user_id',identity.id).select('id,name,envelope_type,tracking_mode,target_amount,current_amount,cash_balance,carryover_amount,rollover_enabled,cash_enabled,priority,is_active,created_at,updated_at').maybeSingle();if(error)return NextResponse.json({error:'finance_envelope_update_failed',detail:error.message},{status:500});if(!data)return NextResponse.json({error:'Not found'},{status:404});return NextResponse.json({envelope:data})}
export async function DELETE(request:NextRequest,context:Context){const identity=await requireFinanceIdentity(request);if(!identity)return financeUnauthorized();const{id}=await context.params;const{data,error}=await supabaseAdmin.from('finance_envelopes').update({is_active:false,updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',identity.id).select('id').maybeSingle();if(error)return NextResponse.json({error:'finance_envelope_delete_failed',detail:error.message},{status:500});if(!data)return NextResponse.json({error:'Not found'},{status:404});return NextResponse.json({ok:true})}
