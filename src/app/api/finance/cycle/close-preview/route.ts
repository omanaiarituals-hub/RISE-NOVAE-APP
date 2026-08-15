import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { financeUnauthorized, requireFinanceIdentity } from '@/lib/finance/api'
import { buildFinanceForecast } from '@/lib/finance/services/forecast'

export async function GET(request:NextRequest){ const identity=await requireFinanceIdentity(request); if(!identity)return financeUnauthorized(); try{ const forecast=await buildFinanceForecast(identity.id); const {data:goals,error}=await supabaseAdmin.from('finance_goals').select('id,name,goal_type,target_amount,current_amount,priority').eq('user_id',identity.id).eq('status','active').order('priority',{ascending:true}); if(error)throw error; const surplus=Math.max(0,Number(forecast.real_available||0)); return NextResponse.json({surplus,cash_remainder:forecast.cash_total,suggested_goal:(goals??[]).find(g=>['emergency_fund','savings','travel','project'].includes(g.goal_type))??null,message:surplus>0?`Il reste ${surplus.toLocaleString('fr-FR',{maximumFractionDigits:2})} € réellement libres après réserves et plancher de sécurité.`:'Aucun surplus libre n’est détecté pour le moment.'}) }catch(error){ return NextResponse.json({error:'finance_close_preview_failed',detail:error instanceof Error?error.message:'Erreur.'},{status:500}) } }
