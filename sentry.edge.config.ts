import * as Sentry from '@sentry/nextjs'

const isProduction = process.env.NODE_ENV === 'production'

Sentry.init({
  dsn: 'https://68faea44615d15a85c8f97d4ab07a4ca@o4511655482949632.ingest.de.sentry.io/4511655502348368',

  tracesSampleRate: isProduction ? 0.1 : 0,
  enableLogs: false,
  sendDefaultPii: false,

  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
})
