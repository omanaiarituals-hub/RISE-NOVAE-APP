// src/lib/logger.ts
// Logger de production : supprime les console.log en prod, garde les erreurs.
// Usage : import { log } from '@/lib/logger'
//         log.info('message')   → visible seulement en dev
//         log.error('message')  → toujours visible (erreurs réelles)

const isProd = process.env.NODE_ENV === 'production'

export const log = {
  info: (...args: unknown[]) => { if (!isProd) console.log(...args) },
  debug: (...args: unknown[]) => { if (!isProd) console.log('[debug]', ...args) },
  error: (...args: unknown[]) => { console.error(...args) },
  warn: (...args: unknown[]) => { console.warn(...args) },
}