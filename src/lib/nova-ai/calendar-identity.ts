export type CalendarIdentityEvent = {
  id: string
  title: string
  start_date: string
  end_date: string
  location: string | null
  attendees: string[] | null
  status: string | null
}

export type CalendarIdentityMatch = {
  event: CalendarIdentityEvent
  score: number
  reasons: string[]
}

const STOP_WORDS = new Set([
  'a','au','aux','avec','ce','cette','chez','de','des','du','en','et','la','le','les','mon','ma','mes',
  'pour','rendez','rendezvous','rdv','un','une','vers','deplacer','deplace','decale','decaler','annule','annuler',
  'mardi','mercredi','jeudi','vendredi','samedi','dimanche','lundi','heure','heures','h'
])

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function tokens(value: string): Set<string> {
  const result = new Set<string>()
  normalize(value).split(/\s+/).forEach((token) => {
    if (token.length >= 2 && !STOP_WORDS.has(token)) result.add(token)
  })
  return result
}

function intersectionRatio(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0
  let shared = 0
  left.forEach((value) => {
    if (right.has(value)) shared += 1
  })
  return shared / Math.max(1, Math.min(left.size, right.size))
}

function parisParts(iso: string): { weekday: string; hour: number; minute: number } | null {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const weekday = normalize(parts.find((part) => part.type === 'weekday')?.value || '')
  const hour = Number.parseInt(parts.find((part) => part.type === 'hour')?.value || '', 10)
  const minute = Number.parseInt(parts.find((part) => part.type === 'minute')?.value || '', 10)
  if (!weekday || !Number.isFinite(hour) || !Number.isFinite(minute)) return null
  return { weekday, hour, minute }
}

function requestedWeekday(message: string): string | null {
  const normalized = normalize(message)
  const weekdays = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche']
  for (const weekday of weekdays) {
    if (new RegExp(`\\b${weekday}\\b`).test(normalized)) return weekday
  }
  return null
}

function requestedHour(message: string): number | null {
  const match = normalize(message).match(/\b([01]?\d|2[0-3])\s*(?:h|heure|heures)\b/)
  if (!match) return null
  const hour = Number.parseInt(match[1], 10)
  return Number.isFinite(hour) ? hour : null
}

export function findBestCalendarMatches(
  message: string,
  events: CalendarIdentityEvent[],
  minimumScore = 0.2
): CalendarIdentityMatch[] {
  const messageTokens = tokens(message)
  const weekday = requestedWeekday(message)
  const hour = requestedHour(message)

  return events
    .filter((event) => event.status !== 'cancelled')
    .map((event) => {
      const titleTokens = tokens(event.title || '')
      const attendeeTokens = tokens((event.attendees || []).join(' '))
      const locationTokens = tokens(event.location || '')
      const titleRatio = intersectionRatio(messageTokens, titleTokens)
      const attendeeRatio = intersectionRatio(messageTokens, attendeeTokens)
      const locationRatio = intersectionRatio(messageTokens, locationTokens)
      const eventParts = parisParts(event.start_date)
      const weekdayMatch = Boolean(weekday && eventParts?.weekday === weekday)
      const hourMatch = Boolean(hour !== null && eventParts?.hour === hour)

      let score = titleRatio * 0.68 + attendeeRatio * 0.14 + locationRatio * 0.08
      if (weekdayMatch) score += 0.07
      if (hourMatch) score += 0.03
      score = Math.min(1, score)

      const reasons: string[] = []
      if (titleRatio > 0) reasons.push('titre correspondant')
      if (attendeeRatio > 0) reasons.push('participant correspondant')
      if (locationRatio > 0) reasons.push('lieu correspondant')
      if (weekdayMatch) reasons.push('jour correspondant')
      if (hourMatch) reasons.push('heure correspondante')

      return { event, score, reasons }
    })
    .filter((match) => match.score >= minimumScore)
    .sort((left, right) => right.score - left.score)
}
