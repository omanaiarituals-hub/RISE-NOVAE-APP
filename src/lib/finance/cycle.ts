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
  const next = dateAtDay(start.getFullYear(), start.getMonth() + 1, incomeDay)
  const end = new Date(next)
  end.setDate(end.getDate() - 1)

  return {
    start: iso(start),
    end: iso(end),
    label: `${new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(start)} → ${new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(end)}`,
  }
}
