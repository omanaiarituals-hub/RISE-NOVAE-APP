import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { financeUnauthorized, requireFinanceIdentity } from '@/lib/finance/api'
import { resolveFinanceCycle } from '@/lib/finance/cycle'
import { buildFinanceForecast } from '@/lib/finance/services/forecast'

export async function GET(request:NextRequest){
  const identity=await requireFinanceIdentity(request)
  if(!identity)return financeUnauthorized()
  try{
    const[{data:profile,error:profileError},forecast]=await Promise.all([
      supabaseAdmin.from('finance_user_profiles').select('usual_income_day').eq('user_id',identity.id).maybeSingle(),
      buildFinanceForecast(identity.id),
    ])
    if(profileError)throw profileError
    const cycle=resolveFinanceCycle(profile?.usual_income_day??null)
    const[{data:spend,error:e1},{data:savings,error:e2},{data:savingGoals,error:e4},{data:recent,error:e3}]=await Promise.all([
      supabaseAdmin.from('finance_envelopes').select('id,name,tracking_mode,target_amount,current_amount,cash_balance,cash_enabled,rollover_enabled,priority').eq('user_id',identity.id).eq('is_active',true).eq('tracking_mode','spend').order('priority',{ascending:true}),
      supabaseAdmin.from('finance_envelopes').select('id,name,tracking_mode,target_amount,current_amount,cash_balance,cash_enabled,priority').eq('user_id',identity.id).eq('is_active',true).eq('tracking_mode','accumulate').order('priority',{ascending:true}),
      supabaseAdmin.from('finance_goals').select('id,name,tracking_mode,target_amount,current_amount,monthly_target,priority,status').eq('user_id',identity.id).eq('status','active').eq('tracking_mode','accumulate').order('priority',{ascending:true}),
      supabaseAdmin.from('finance_cycle_closures').select('id,cycle_start,cycle_end,total_remainder,savings_allocated,bank_remainder,cash_remainder,closed_at').eq('user_id',identity.id).order('closed_at',{ascending:false}).limit(6),
    ])
    if(e1)throw e1;if(e2)throw e2;if(e3)throw e3;if(e4)throw e4

    const envelopes=(spend??[]).map(item=>{
      const target=Number(item.target_amount||0),spent=Number(item.current_amount||0),variance=target-spent
      return{...item,target_amount:target,spent_amount:spent,cash_balance:Number(item.cash_balance||0),variance_amount:variance,remainder_amount:variance,variance_status:variance>0?'saved':variance<0?'overspent':'on_target',default_action:item.rollover_enabled?'rollover':'leave'}
    })
    const savingEnvelopes=(savings??[]).map(item=>{
      const target=Number(item.target_amount||0),saved=Number(item.current_amount||0),gap=saved-target
      return{...item,target_amount:target,current_amount:saved,cash_balance:Number(item.cash_balance||0),gap_amount:gap,status:gap>0?'exceeded':gap<0?'missing':'reached'}
    })
    const goals=(savingGoals??[]).map(item=>{
      const target=Number(item.monthly_target??item.target_amount??0),saved=Number(item.current_amount||0),gap=saved-target
      return{...item,cycle_target:target,current_amount:saved,gap_amount:gap,status:gap>0?'exceeded':gap<0?'missing':'reached'}
    })

    return NextResponse.json({
      cycle,forecast,envelopes,
      savings_destinations:savingEnvelopes,
      savings_summary:{
        envelopes:savingEnvelopes,
        goals,
        planned:savingEnvelopes.reduce((s,x)=>s+x.target_amount,0)+goals.reduce((s,x)=>s+x.cycle_target,0),
        actual:savingEnvelopes.reduce((s,x)=>s+x.current_amount,0)+goals.reduce((s,x)=>s+x.current_amount,0),
      },
      total_remainder:envelopes.reduce((s,x)=>s+Math.max(0,x.variance_amount),0),
      total_overspend:envelopes.reduce((s,x)=>s+Math.max(0,-x.variance_amount),0),
      recent_closures:recent??[],
    })
  }catch(error){
    return NextResponse.json({error:'finance_close_preview_failed',detail:error instanceof Error?error.message:'Impossible de préparer la clôture.'},{status:500})
  }
}
