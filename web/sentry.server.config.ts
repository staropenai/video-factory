import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Performance: capture all transactions in production
  tracesSampleRate: 1.0,

  // Only enable when DSN is configured
  enabled: !!process.env.SENTRY_DSN,

  environment: process.env.NODE_ENV,
  sendDefaultPii: false,
  sampleRate: 1.0,
});
