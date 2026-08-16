import { supabaseAdmin } from '@/lib/supabase-admin'
import { buildFinanceForecast } from '@/lib/finance/services/forecast'

type ScenarioInput = {
  extraSpend?: number
  extraSavings?: number
  spendReduction?: number
  incomeDelta?: number
}

type GoalRow = {
  id: string
  name: string
  tracking_mode: 'spend' | 'accumulate' | 'repay'
  repayment_kind: 'overdraft' | 'debt' | 'credit' | null
  target_amount: number | string | null
  current_amount: number | string | null
  monthly_target: number | string | null
  target_date: string | null
  priority: number | null
  status: string
}

type EnvelopeRow = {
  id: string
  name: string
  tracking_mode: 'spend' | 'accumulate' | 'repay'
  target_amount: number | string | null
  current_amount: number | string | null
  priority: number | null
}

function n(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

function monthsUntil(date: string | null) {
  if (!date) return null
  const target = new Date(`${date}T12:00:00`)
  if (Number.isNaN(target.getTime())) return null
  const now = new Date()
  const months = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth())
  return Math.max(1, months)
}

function remainingForGoal(goal: GoalRow) {
  return Math.max(0, n(goal.target_amount) - n(goal.current_amount))
}

function monthlyNeed(goal: GoalRow) {
  const explicit = n(goal.monthly_target)
  if (explicit > 0) return explicit
  const remaining = remainingForGoal(goal)
  const months = monthsUntil(goal.target_date)
  if (!months || remaining <= 0) return 0
  return round2(remaining / months)
}

export async function buildNovaAdvancedPlan(userId: string, scenario: ScenarioInput = {}) {
  const baseline = await buildFinanceForecast(userId)
  const [goalsResult, envelopesResult, profileResult, recalibrationMovementsResult] = await Promise.all([
    supabaseAdmin
      .from('finance_goals')
      .select('id,name,tracking_mode,repayment_kind,target_amount,current_amount,monthly_target,target_date,priority,status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('priority', { ascending: true }),
    supabaseAdmin
      .from('finance_envelopes')
      .select('id,name,tracking_mode,target_amount,current_amount,priority')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('priority', { ascending: true }),
    supabaseAdmin
      .from('finance_user_profiles')
      .select('usual_net_income,safety_floor,minimum_account_buffer,current_overdraft')
      .eq('user_id', userId)
      .maybeSingle(),
    supabaseAdmin
      .from('finance_envelope_movements')
      .select('envelope_id,amount,movement_type,created_at')
      .eq('user_id', userId)
      .eq('movement_type', 'adjustment')
      .gte('created_at', new Date(Date.now() - 1000 * 60 * 60 * 24 * 100).toISOString()),
  ])

  const error = goalsResult.error || envelopesResult.error || profileResult.error || recalibrationMovementsResult.error
  if (error) throw new Error(error.message)

  const goals = (goalsResult.data ?? []) as GoalRow[]
  const envelopes = (envelopesResult.data ?? []) as EnvelopeRow[]
  const baselineAvailable = n(baseline.real_available)
  const extraSpend = Math.max(0, n(scenario.extraSpend))
  const extraSavings = Math.max(0, n(scenario.extraSavings))
  const spendReduction = Math.max(0, n(scenario.spendReduction))
  const incomeDelta = n(scenario.incomeDelta)
  const scenarioAvailable = round2(baselineAvailable - extraSpend - extraSavings + spendReduction + incomeDelta)
  const scenarioDelta = round2(scenarioAvailable - baselineAvailable)

  const goalStatus = goals.map((goal) => {
    const target = n(goal.target_amount)
    const current = n(goal.current_amount)
    const remaining = Math.max(0, target - current)
    const need = monthlyNeed(goal)
    const progress = target > 0 ? Math.min(100, round2((current / target) * 100)) : 0
    const months = need > 0 && remaining > 0 ? Math.ceil(remaining / need) : null
    return {
      id: goal.id,
      name: goal.name,
      tracking_mode: goal.tracking_mode,
      repayment_kind: goal.repayment_kind,
      priority: Number(goal.priority ?? 100),
      target_amount: target,
      current_amount: current,
      remaining,
      monthly_need: need,
      progress,
      estimated_months: months,
      target_date: goal.target_date,
    }
  })

  // Arbitrage purement déterministe : priorité utilisateur, puis remboursements avant accumulation à priorité égale.
  const ordered = goalStatus.slice().sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority
    if (a.tracking_mode === b.tracking_mode) return a.name.localeCompare(b.name, 'fr')
    if (a.tracking_mode === 'repay') return -1
    if (b.tracking_mode === 'repay') return 1
    return 0
  })

  let allocatable = Math.max(0, scenarioAvailable)
  const arbitration: Array<{
    goal_id: string
    name: string
    tracking_mode: string
    priority: number
    suggested_amount: number
    reason: string
  }> = []

  for (let index = 0; index < ordered.length; index += 1) {
    const goal = ordered[index]
    if (allocatable <= 0 || goal.remaining <= 0) break
    const desired = goal.monthly_need > 0 ? Math.min(goal.monthly_need, goal.remaining) : 0
    if (desired <= 0) continue
    const amount = round2(Math.min(allocatable, desired))
    if (amount <= 0) continue
    arbitration.push({
      goal_id: goal.id,
      name: goal.name,
      tracking_mode: goal.tracking_mode,
      priority: goal.priority,
      suggested_amount: amount,
      reason: goal.tracking_mode === 'repay'
        ? 'Priorité de remboursement définie dans tes objectifs.'
        : 'Montant mensuel prévu, dans la limite de ce qui reste réellement disponible.',
    })
    allocatable = round2(allocatable - amount)
  }

  const movements = recalibrationMovementsResult.data ?? []
  const recalibrations = envelopes.flatMap((envelope) => {
    if (envelope.tracking_mode !== 'spend') return []
    const adjustments = movements.filter((movement) => movement.envelope_id === envelope.id && n(movement.amount) > 0)
    if (adjustments.length < 2) return []
    const avgExtra = adjustments.reduce((sum, movement) => sum + n(movement.amount), 0) / adjustments.length
    const currentTarget = n(envelope.target_amount)
    return [{
      envelope_id: envelope.id,
      name: envelope.name,
      current_target: currentTarget,
      suggested_target: Math.max(0, Math.round((currentTarget + avgExtra) / 10) * 10),
      average_extra: round2(avgExtra),
      adjustments_count: adjustments.length,
      reason: `Tu as ajouté de l’argent ${adjustments.length} fois récemment.`,
    }]
  })

  const alerts: string[] = []
  if (scenarioAvailable < 0) alerts.push(`Ce scénario descend de ${Math.abs(round2(scenarioAvailable))} € sous ton réellement disponible.`)
  if (baseline.projected_bank_balance != null && n(baseline.projected_bank_balance) < n(baseline.safety_floor)) alerts.push('Le solde prévisionnel passe sous ton plancher de sécurité avant la prochaine rentrée d’argent.')
  if (goalStatus.some((goal) => goal.monthly_need === 0 && goal.remaining > 0)) alerts.push('Certains objectifs n’ont ni montant mensuel ni date cible : Nova ne les arbitre pas automatiquement.')

  return {
    baseline,
    scenario: {
      extra_spend: extraSpend,
      extra_savings: extraSavings,
      spend_reduction: spendReduction,
      income_delta: incomeDelta,
      real_available: scenarioAvailable,
      delta: scenarioDelta,
    },
    profile: {
      usual_net_income: profileResult.data?.usual_net_income == null ? null : n(profileResult.data.usual_net_income),
      safety_floor: n(profileResult.data?.safety_floor),
      minimum_account_buffer: n(profileResult.data?.minimum_account_buffer),
      current_overdraft: n(profileResult.data?.current_overdraft),
    },
    goals: goalStatus,
    arbitration,
    unallocated_after_plan: Math.max(0, round2(allocatable)),
    recalibrations,
    alerts,
    calculation_note: 'Calcul déterministe. Nova ne modifie aucun objectif ni aucune enveloppe sans validation explicite.',
  }
}
