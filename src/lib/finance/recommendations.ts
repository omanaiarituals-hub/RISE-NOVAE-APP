export type FinanceRecommendationEnvelope = {
  key: string
  name: string
  envelope_type: 'monthly' | 'cumulative' | 'goal' | 'debt' | 'temporary'
  target_amount: number
  rollover_enabled: boolean
  cash_enabled: boolean
  reason: string
  confidence: 'low' | 'medium' | 'high'
}

export type FinanceRecommendationGoal = {
  key: string
  name: string
  goal_type: 'overdraft' | 'emergency_fund' | 'travel' | 'project' | 'debt' | 'savings' | 'custom'
  target_amount: number
  monthly_target: number | null
  reason: string
  confidence: 'low' | 'medium' | 'high'
}

export type FinanceRecommendationContext = {
  usual_income: number | null
  observed_monthly_income: number | null
  observed_monthly_expenses: number | null
  current_overdraft: number
  overdraft_limit: number
  months_analysed: number
  transactions_count: number
  recurring_commitments: number
  basis: string[]
}

export type FinanceRecommendations = {
  context: FinanceRecommendationContext
  envelopes: FinanceRecommendationEnvelope[]
  goals: FinanceRecommendationGoal[]
  warnings: string[]
}

const round5 = (value: number) => Math.max(0, Math.round(value / 5) * 5)
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function buildFinanceRecommendations(input: {
  usualIncome: number | null
  observedMonthlyIncome: number | null
  observedMonthlyExpenses: number | null
  currentOverdraft: number
  overdraftLimit: number
  monthsAnalysed: number
  transactionsCount: number
  recurringCommitmentsMonthly: number
  categoryMonthly: Record<string, number>
  existingEnvelopeNames: string[]
  existingGoalTypes: string[]
}): FinanceRecommendations {
  const income = input.observedMonthlyIncome && input.observedMonthlyIncome > 0
    ? input.observedMonthlyIncome
    : input.usualIncome

  const warnings: string[] = []
  const basis: string[] = []
  if (input.transactionsCount > 0) basis.push(`${input.transactionsCount} opérations analysées`)
  if (input.monthsAnalysed > 0) basis.push(`${input.monthsAnalysed} mois de données observées`)
  if (input.usualIncome) basis.push(`revenu déclaré ${Math.round(input.usualIncome)} €`)
  if (input.recurringCommitmentsMonthly > 0) basis.push(`${Math.round(input.recurringCommitmentsMonthly)} € d’engagements récurrents/mois`)

  if (!income) warnings.push("Ajoute ton revenu habituel ou connecte une banque pour obtenir des montants plus fiables.")
  if (input.transactionsCount < 20) warnings.push("Nova manque encore d’historique : les montants proposés restent prudents et devront être validés.")

  const existingEnvelopeSet = new Set(input.existingEnvelopeNames.map((name) => name.trim().toLowerCase()))
  const existingGoalSet = new Set(input.existingGoalTypes)
  const envelopes: FinanceRecommendationEnvelope[] = []
  const goals: FinanceRecommendationGoal[] = []

  const confidence: 'low' | 'medium' | 'high' = input.transactionsCount >= 60 ? 'high' : input.transactionsCount >= 20 || !!income ? 'medium' : 'low'

  const addEnvelope = (item: FinanceRecommendationEnvelope) => {
    if (!existingEnvelopeSet.has(item.name.toLowerCase())) envelopes.push(item)
  }

  const category = (slug: string) => Number(input.categoryMonthly[slug] || 0)
  const monthlyIncome = income || 0

  const groceriesObserved = category('groceries')
  const groceriesTarget = groceriesObserved > 0
    ? round5(clamp(groceriesObserved * 0.95, groceriesObserved * 0.8, groceriesObserved * 1.05))
    : monthlyIncome > 0 ? round5(clamp(monthlyIncome * 0.15, 250, 650)) : 350
  addEnvelope({
    key: 'groceries', name: 'Courses', envelope_type: 'monthly', target_amount: groceriesTarget,
    rollover_enabled: false, cash_enabled: true,
    reason: groceriesObserved > 0 ? `Basé sur une moyenne observée d’environ ${Math.round(groceriesObserved)} € par mois.` : 'Montant prudent calculé à partir de ton revenu disponible.',
    confidence,
  })

  const childrenObserved = category('children')
  if (childrenObserved > 0 || monthlyIncome > 0) {
    const childrenTarget = childrenObserved > 0 ? round5(Math.max(childrenObserved, 100)) : round5(clamp(monthlyIncome * 0.05, 80, 250))
    addEnvelope({
      key: 'children', name: 'Enfants / besoins', envelope_type: 'cumulative', target_amount: childrenTarget,
      rollover_enabled: true, cash_enabled: true,
      reason: childrenObserved > 0 ? `Prévoit les dépenses enfants observées et laisse le solde s’accumuler pour les frais irréguliers.` : 'Enveloppe cumulative pour absorber école, vêtements, santé et besoins ponctuels.',
      confidence,
    })
  }

  const tobaccoObserved = category('tobacco')
  if (tobaccoObserved > 0) {
    const reductionTarget = round5(Math.max(0, tobaccoObserved * 0.7))
    addEnvelope({
      key: 'tobacco', name: 'Tabac', envelope_type: 'monthly', target_amount: reductionTarget,
      rollover_enabled: false, cash_enabled: true,
      reason: `Dépense observée ≈ ${Math.round(tobaccoObserved)} €/mois. Nova propose une première baisse d’environ 30 %, modifiable librement.`,
      confidence,
    })
  }

  const leisureObserved = category('leisure') + category('shopping')
  if (monthlyIncome > 0 || leisureObserved > 0) {
    const pleasureTarget = leisureObserved > 0
      ? round5(clamp(leisureObserved * 0.75, 80, Math.max(120, monthlyIncome * 0.12 || 300)))
      : round5(clamp(monthlyIncome * 0.06, 80, 250))
    addEnvelope({
      key: 'pleasure', name: 'Plaisir', envelope_type: 'monthly', target_amount: pleasureTarget,
      rollover_enabled: false, cash_enabled: true,
      reason: 'Garde une marge plaisir explicite pour éviter un budget trop restrictif et donc difficile à tenir.',
      confidence,
    })
  }

  if (monthlyIncome > 0) {
    addEnvelope({
      key: 'unexpected', name: 'Imprévus courants', envelope_type: 'cumulative', target_amount: round5(clamp(monthlyIncome * 0.035, 75, 180)),
      rollover_enabled: true, cash_enabled: false,
      reason: 'Petite réserve cumulative pour absorber les dépenses irrégulières sans casser le reste du budget.',
      confidence,
    })
  }

  if (input.currentOverdraft > 0 && !existingGoalSet.has('overdraft')) {
    const monthly = monthlyIncome > 0 ? round5(clamp(input.currentOverdraft / 3, 150, monthlyIncome * 0.15)) : round5(input.currentOverdraft / 3)
    goals.push({
      key: 'overdraft', name: 'Sortir du découvert', goal_type: 'overdraft', target_amount: input.currentOverdraft,
      monthly_target: monthly,
      reason: `Découvert déclaré de ${Math.round(input.currentOverdraft)} €. Nova propose de le résorber progressivement sans assécher ton mois.`,
      confidence: 'high',
    })
  }

  if (!existingGoalSet.has('emergency_fund') && monthlyIncome > 0) {
    const emergencyTarget = round5(Math.max(1000, monthlyIncome * 0.67))
    goals.push({
      key: 'emergency', name: 'Épargne de sécurité', goal_type: 'emergency_fund', target_amount: emergencyTarget,
      monthly_target: round5(clamp(monthlyIncome * 0.1, 100, 500)),
      reason: 'Premier palier de sécurité destiné à éviter de revenir au découvert lors d’un imprévu.',
      confidence,
    })
  }

  return {
    context: {
      usual_income: input.usualIncome,
      observed_monthly_income: input.observedMonthlyIncome,
      observed_monthly_expenses: input.observedMonthlyExpenses,
      current_overdraft: input.currentOverdraft,
      overdraft_limit: input.overdraftLimit,
      months_analysed: input.monthsAnalysed,
      transactions_count: input.transactionsCount,
      recurring_commitments: input.recurringCommitmentsMonthly,
      basis,
    },
    envelopes,
    goals,
    warnings,
  }
}
