export type FinanceCycleWindow = {
  start: string
  end: string
  label: string
}

function iso(date: Date) {
  return date.toISOString().slice(0, 10)
}

function dateAtDay(year: number, month: number, day: number) {
  const end = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(day, end), 12, 0, 0, 0)
}

function cycleFromStart(start: Date, incomeDay: number) {
  const next = dateAtDay(start.getFullYear(), start.getMonth() + 1, incomeDay)
  const end = new Date(next)
  end.setDate(end.getDate() - 1)
  return {
    start: iso(start),
    end: iso(end),
    label: `${new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(start)} → ${new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(end)}`,
  }
}

export function resolveFinanceCycle(incomeDay: number | null | undefined, now = new Date()): FinanceCycleWindow {
  if (!incomeDay || incomeDay < 1 || incomeDay > 31) {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 12)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 12)
    return {
      start: iso(start),
      end: iso(end),
      label: new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(start),
    }
  }

  const thisMonth = dateAtDay(now.getFullYear(), now.getMonth(), incomeDay)
  const start = now >= thisMonth ? thisMonth : dateAtDay(now.getFullYear(), now.getMonth() - 1, incomeDay)
  return cycleFromStart(start, incomeDay)
}

export function resolveFinanceCycleOffset(
  incomeDay: number | null | undefined,
  offset = 0,
  now = new Date(),
): FinanceCycleWindow {
  const current = resolveFinanceCycle(incomeDay, now)
  if (!offset) return current

  const base = new Date(`${current.start}T12:00:00`)
  if (!incomeDay || incomeDay < 1 || incomeDay > 31) {
    const start = new Date(base.getFullYear(), base.getMonth() + offset, 1, 12)
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 12)
    return {
      start: iso(start),
      end: iso(end),
      label: new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(start),
    }
  }

  const start = dateAtDay(base.getFullYear(), base.getMonth() + offset, incomeDay)
  return cycleFromStart(start, incomeDay)
}

export function resolveFinanceYearWindow(now = new Date()): FinanceCycleWindow {
  const start = new Date(now.getFullYear(), 0, 1, 12)
  const end = new Date(now.getFullYear(), 11, 31, 12)
  return {
    start: iso(start),
    end: iso(end),
    label: `Cumul ${now.getFullYear()}`,
  }
}

export function monthlyEquivalent(amount: number, frequency: string | null | undefined) {
  const value = Math.abs(Number(amount || 0))
  const normalized = String(frequency || 'monthly').toLowerCase()
  if (normalized === 'yearly' || normalized === 'annual') return value / 12
  if (normalized === 'weekly') return value * 52 / 12
  if (normalized === 'quarterly') return value / 3
  return value
}
