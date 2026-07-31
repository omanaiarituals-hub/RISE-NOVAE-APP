const PARIS_TIMEZONE = 'Europe/Paris'

function parisParts(iso: string): { hour: number; minute: number } {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Date ISO invalide : ${iso}`)
  }

  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: PARIS_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const hour = Number.parseInt(parts.find((part) => part.type === 'hour')?.value || '', 10)
  const minute = Number.parseInt(parts.find((part) => part.type === 'minute')?.value || '', 10)

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    throw new Error(`Impossible de convertir la date en heure de Paris : ${iso}`)
  }

  return { hour, minute }
}

export function parisMinutesFromIso(iso: string): number {
  const { hour, minute } = parisParts(iso)
  return hour * 60 + minute
}

export function formatParisDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) throw new Error(`Date ISO invalide : ${iso}`)

  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: PARIS_TIMEZONE,
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(date)
}

export { PARIS_TIMEZONE }
