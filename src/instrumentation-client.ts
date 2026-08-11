import * as Sentry from '@sentry/nextjs'

const isProduction = process.env.NODE_ENV === 'production'

Sentry.init({
  dsn: 'https://68faea44615d15a85c8f97d4ab07a4ca@o4511655482949632.ingest.de.sentry.io/4511655502348368',

  // Palier 100 : 10 % des traces suffit pour suivre les performances.
  tracesSampleRate: isProduction ? 0.1 : 0,

  // Pas de Sentry Logs côté navigateur.
  enableLogs: false,

  // Session Replay désactivé : NOVAÉ contient trop de données personnelles
  // pour justifier l'enregistrement de sessions au stade actuel.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  // Ne pas joindre automatiquement IP / cookies / informations utilisateur.
  sendDefaultPii: false,

  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
