/**
 * src/instrumentation.ts — Next.js instrumentation hook.
 *
 * Runs once at server startup (before any request is handled).
 * Validates that required environment variables are set and logs
 * warnings for optional-but-recommended ones.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only validate on the server (not edge)
  if (process.env.NEXT_RUNTIME === "edge") return;

  // ── Sentry APM initialization ─────────────────────────────────
  if (process.env.SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 1.0,
      enabled: true,
      environment: process.env.NODE_ENV,
      sendDefaultPii: false,
    });
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  // ── Required in production ──────────────────────────────────────
  const required = [
    "JTG_JWT_SECRET",
  ];

  for (const key of required) {
    if (!process.env[key]) {
      if (process.env.NODE_ENV === "production") {
        errors.push(`Missing required env var: ${key}`);
      } else {
        warnings.push(`Missing env var ${key} — using dev fallback`);
      }
    }
  }

  // ── Recommended (warn if missing) ──────────────────────────────
  const recommended: { key: string; note: string }[] = [
    { key: "OPENAI_API_KEY", note: "AI features (Tier C streaming) will be unavailable" },
    { key: "JTG_SESSION_SECRET", note: "Session tokens will use JWT secret as fallback" },
    { key: "JTG_ADMIN_TOKEN", note: "Admin endpoints will be inaccessible" },
  ];

  for (const { key, note } of recommended) {
    if (!process.env[key]) {
      warnings.push(`Missing env var ${key} — ${note}`);
    }
  }

  // ── Report ─────────────────────────────────────────────────────
  if (warnings.length > 0) {
    console.warn(
      `[JTG startup] ${warnings.length} warning(s):\n` +
        warnings.map((w) => `  ⚠ ${w}`).join("\n")
    );
  }

  if (errors.length > 0) {
    const msg =
      `[JTG startup] ${errors.length} critical error(s):\n` +
      errors.map((e) => `  ✗ ${e}`).join("\n");

    if (process.env.NODE_ENV === "production") {
      // In production, throw to prevent serving with broken config
      throw new Error(msg);
    } else {
      console.error(msg);
    }
  }
}
