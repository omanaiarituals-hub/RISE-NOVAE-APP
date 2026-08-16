export type FinancialNature =
  | 'income'
  | 'expense'
  | 'internal_transfer'
  | 'third_party_advance'
  | 'refund'
  | 'reimbursable_expense'
  | 'exceptional_expense'
  | 'installment'
  | 'subscription'
  | 'cash_withdrawal'
  | 'cash_expense'

export type TransactionForAnalysis = {
  id: string
  transaction_date: string
  amount: number | string
  direction: 'credit' | 'debit'
  raw_label: string | null
  merchant_name: string | null
  provider_category: string | null
  account_id: string
}

export type MerchantRuleForAnalysis = {
  id: string
  merchant_pattern: string
  normalized_merchant: string | null
  category_id: string | null
  financial_nature: FinancialNature | null
  confidence: number | string | null
}

export type AnalysisDecision = {
  transactionId: string
  normalizedMerchant: string
  categorySlug: string | null
  categoryId: string | null
  financialNature: FinancialNature
  isRecurring: boolean
  isSubscription: boolean
  isInstallment: boolean
  isExceptional: boolean
  isReimbursable: boolean
  isInternalTransfer: boolean
  confidence: number
  source: 'system' | 'merchant_rule'
  reason: string
  matchedRuleId?: string
}

export type RecurringPattern = {
  key: string
  merchant: string
  amount: number
  frequency: 'weekly' | 'monthly'
  confidence: number
  nextDueDate: string | null
  transactionIds: string[]
  isSubscription: boolean
}

const compact = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/\b(cb|carte|paiement|payment|prlv|prelevement|sepa|virement|vir|achat)\b/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ')

export function normalizeMerchant(transaction: Pick<TransactionForAnalysis, 'merchant_name' | 'raw_label'>) {
  const source = transaction.merchant_name || transaction.raw_label || 'operation'
  const normalized = compact(source)
    .replace(/\b\d{2,}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || 'operation'
}

const keywordCategory: Array<{ slug: string; words: string[] }> = [
  { slug: 'housing', words: ['loyer', 'rent', 'edf', 'engie', 'electricite', 'gaz', 'eau', 'internet', 'orange', 'free telecom', 'sfr', 'bouygues'] },
  { slug: 'groceries', words: ['lidl', 'carrefour', 'auchan', 'leclerc', 'intermarche', 'monoprix', 'franprix', 'casino', 'aldi', 'supermarche', 'grocery'] },
  { slug: 'children', words: ['ecole', 'cantine', 'creche', 'scolaire', 'enfant', 'college', 'lycee'] },
  { slug: 'health', words: ['pharmacie', 'pharmacy', 'docteur', 'medecin', 'dentiste', 'dentaire', 'optique', 'hopital', 'sante'] },
  { slug: 'transport', words: ['sncf', 'ratp', 'uber', 'bolt', 'parking', 'peage', 'totalenergies', 'essence', 'station service', 'transport'] },
  { slug: 'leisure', words: ['restaurant', 'resto', 'cinema', 'spotify', 'deezer', 'loisir', 'booking', 'airbnb'] },
  { slug: 'shopping', words: ['amazon', 'zalando', 'shein', 'temu', 'ikea', 'fnac', 'darty', 'shopping'] },
  { slug: 'tobacco', words: ['tabac', 'source', 'snc l3v', 'jajo feras', 'le seven', 'relais neyron'] },
  { slug: 'subscriptions', words: ['netflix', 'disney', 'spotify', 'deezer', 'prime video', 'apple com bill', 'google one'] },
  { slug: 'professional', words: ['urssaf', 'impot pro', 'stripe', 'vercel', 'supabase', 'openai', 'anthropic'] },
  { slug: 'travel', words: ['airbnb', 'booking', 'air france', 'easyjet', 'ryanair', 'hotel', 'voyage'] },
  { slug: 'savings', words: ['livret', 'epargne', 'savings'] },
]

const salaryWords = ['salaire', 'salary', 'paie', 'payroll', 'remuneration']
const refundWords = ['remboursement', 'refund', 'avoir', 'recredit', 'restitution']
const cashWords = ['retrait', 'dab', 'atm', 'distributeur']
const installmentWords = ['alma', 'klarna', 'scalapay', '3x', '4x', '10x', 'paiement fractionne', 'pay in 3', 'pay in 4']
const subscriptionWords = ['netflix', 'disney', 'spotify', 'deezer', 'prime video', 'apple com bill', 'google one', 'abonnement']

function containsAny(value: string, words: string[]) {
  return words.some((word) => value.includes(compact(word)))
}

function dateDiffDays(a: string, b: string) {
  return Math.abs(new Date(`${a}T12:00:00Z`).getTime() - new Date(`${b}T12:00:00Z`).getTime()) / 86400000
}

function addDays(value: string, days: number) {
  const d = new Date(`${value}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function nextFutureDate(lastDate: string, intervalDays: number) {
  const step = Math.max(1, Math.round(intervalDays))
  let next = addDays(lastDate, step)
  const today = new Date().toISOString().slice(0, 10)
  let guard = 0
  while (next <= today && guard < 120) {
    next = addDays(next, step)
    guard += 1
  }
  return next > today ? next : addDays(today, step)
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  if (!sorted.length) return 0
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function detectRecurringPatterns(transactions: TransactionForAnalysis[]): RecurringPattern[] {
  const groups = new Map<string, TransactionForAnalysis[]>()
  for (const tx of transactions) {
    if (tx.direction !== 'debit') continue
    const key = normalizeMerchant(tx)
    if (key === 'operation') continue
    const list = groups.get(key) || []
    list.push(tx)
    groups.set(key, list)
  }

  const patterns: RecurringPattern[] = []
  for (const [key, txs] of groups) {
    if (txs.length < 2) continue
    const ordered = [...txs].sort((a, b) => a.transaction_date.localeCompare(b.transaction_date))
    const intervals = ordered.slice(1).map((item, i) => dateDiffDays(item.transaction_date, ordered[i].transaction_date))
    const typicalInterval = median(intervals)
    const frequency = typicalInterval >= 20 && typicalInterval <= 40 ? 'monthly' : typicalInterval >= 5 && typicalInterval <= 9 ? 'weekly' : null
    if (!frequency) continue
    const amounts = ordered.map((item) => Math.abs(Number(item.amount)))
    const typicalAmount = median(amounts)
    if (typicalAmount <= 0) continue
    const maxDeviation = Math.max(...amounts.map((amount) => Math.abs(amount - typicalAmount) / typicalAmount))
    if (maxDeviation > 0.25) continue
    const label = compact(`${ordered[0].merchant_name || ''} ${ordered[0].raw_label || ''} ${ordered[0].provider_category || ''}`)
    const isSubscription = containsAny(label, subscriptionWords) || compact(ordered[0].provider_category || '').includes('subscription')
    const occurrenceScore = Math.min(1, ordered.length / 4)
    const regularityScore = Math.max(0, 1 - maxDeviation)
    const confidence = Math.min(0.98, 0.55 + occurrenceScore * 0.25 + regularityScore * 0.18)
    patterns.push({
      key,
      merchant: ordered[0].merchant_name || ordered[0].raw_label || key,
      amount: Math.round(typicalAmount * 100) / 100,
      frequency,
      confidence: Math.round(confidence * 1000) / 1000,
      nextDueDate: nextFutureDate(ordered[ordered.length - 1].transaction_date, frequency === 'monthly' ? typicalInterval : 7),
      transactionIds: ordered.map((item) => item.id),
      isSubscription,
    })
  }
  return patterns
}

function matchRule(normalized: string, rules: MerchantRuleForAnalysis[]) {
  return rules.find((rule) => {
    const candidate = compact(rule.normalized_merchant || rule.merchant_pattern)
    return candidate.length >= 3 && (normalized === candidate || normalized.includes(candidate) || candidate.includes(normalized))
  })
}

function categoryFromText(text: string) {
  const hit = keywordCategory.find((item) => containsAny(text, item.words))
  return hit?.slug || null
}

function isLikelyInternalTransfer(tx: TransactionForAnalysis, transactions: TransactionForAnalysis[]) {
  const amount = Math.abs(Number(tx.amount))
  if (amount === 0) return false
  return transactions.some((other) => other.id !== tx.id
    && other.account_id !== tx.account_id
    && other.direction !== tx.direction
    && Math.abs(Math.abs(Number(other.amount)) - amount) < 0.01
    && dateDiffDays(other.transaction_date, tx.transaction_date) <= 2)
}

export function analyseTransactions(input: {
  transactions: TransactionForAnalysis[]
  rules: MerchantRuleForAnalysis[]
  categoryIdBySlug: Map<string, string>
}) {
  const recurring = detectRecurringPatterns(input.transactions)
  const recurringByTx = new Map<string, RecurringPattern>()
  for (const pattern of recurring) for (const id of pattern.transactionIds) recurringByTx.set(id, pattern)

  const decisions: AnalysisDecision[] = input.transactions.map((tx) => {
    const normalized = normalizeMerchant(tx)
    const text = compact(`${tx.merchant_name || ''} ${tx.raw_label || ''} ${tx.provider_category || ''}`)
    const rule = matchRule(normalized, input.rules)
    const recurringPattern = recurringByTx.get(tx.id)

    if (rule) {
      const nature = rule.financial_nature || (tx.direction === 'credit' ? 'income' : 'expense')
      return {
        transactionId: tx.id,
        normalizedMerchant: normalized,
        categorySlug: null,
        categoryId: rule.category_id,
        financialNature: nature,
        isRecurring: !!recurringPattern,
        isSubscription: nature === 'subscription' || !!recurringPattern?.isSubscription,
        isInstallment: nature === 'installment',
        isExceptional: nature === 'exceptional_expense',
        isReimbursable: nature === 'reimbursable_expense',
        isInternalTransfer: nature === 'internal_transfer',
        confidence: Math.max(0.9, Number(rule.confidence || 1)),
        source: 'merchant_rule',
        reason: 'Règle marchand validée par l’utilisateur.',
        matchedRuleId: rule.id,
      }
    }

    const internalTransfer = isLikelyInternalTransfer(tx, input.transactions)
    let nature: FinancialNature = tx.direction === 'credit' ? 'income' : 'expense'
    let reason = tx.direction === 'credit' ? 'Entrée d’argent détectée.' : 'Dépense détectée.'
    let confidence = 0.65

    if (internalTransfer) {
      nature = 'internal_transfer'; reason = 'Montant opposé retrouvé sur un autre compte inclus à ±2 jours.'; confidence = 0.94
    } else if (tx.direction === 'credit' && containsAny(text, refundWords)) {
      nature = 'refund'; reason = 'Libellé de remboursement détecté.'; confidence = 0.91
    } else if (tx.direction === 'credit' && containsAny(text, salaryWords)) {
      nature = 'income'; reason = 'Revenu / salaire détecté dans le libellé.'; confidence = 0.94
    } else if (tx.direction === 'debit' && containsAny(text, cashWords)) {
      nature = 'cash_withdrawal'; reason = 'Retrait d’espèces détecté.'; confidence = 0.95
    } else if (tx.direction === 'debit' && containsAny(text, installmentWords)) {
      nature = 'installment'; reason = 'Paiement fractionné détecté dans le libellé.'; confidence = 0.9
    } else if (tx.direction === 'debit' && recurringPattern?.isSubscription) {
      nature = 'subscription'; reason = 'Débit récurrent régulier identifié comme abonnement.'; confidence = recurringPattern.confidence
    } else if (tx.direction === 'debit' && recurringPattern) {
      nature = 'expense'; reason = `Dépense récurrente ${recurringPattern.frequency === 'monthly' ? 'mensuelle' : 'hebdomadaire'} détectée.`; confidence = recurringPattern.confidence
    }

    let categorySlug = categoryFromText(text)
    if (nature === 'cash_withdrawal') categorySlug = 'cash'
    if (nature === 'subscription' && !categorySlug) categorySlug = 'subscriptions'
    if (nature === 'internal_transfer') categorySlug = null

    return {
      transactionId: tx.id,
      normalizedMerchant: normalized,
      categorySlug,
      categoryId: categorySlug ? input.categoryIdBySlug.get(categorySlug) || null : null,
      financialNature: nature,
      isRecurring: !!recurringPattern,
      isSubscription: nature === 'subscription',
      isInstallment: nature === 'installment',
      isExceptional: nature === 'exceptional_expense',
      isReimbursable: nature === 'reimbursable_expense',
      isInternalTransfer: nature === 'internal_transfer',
      confidence,
      source: 'system',
      reason,
    }
  })

  return { decisions, recurring }
}
