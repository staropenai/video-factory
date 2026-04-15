import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring — capture all transactions
  tracesSampleRate: 1.0,

  // Only enable in production with DSN configured
  enabled:
    process.env.NODE_ENV === "production" &&
    !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  environment: process.env.NODE_ENV,

  // Never send PII
  sendDefaultPii: false,

  // Capture 100% of errors
  sampleRate: 1.0,
});
