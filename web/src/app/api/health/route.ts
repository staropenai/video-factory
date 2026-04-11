/**
 * GET /api/health — Health check endpoint.
 *
 * Reports:
 * - app: always 'healthy' if this route responds
 * - db: checks Python backend connectivity
 * - ts_engine: confirms TS rule engine loads
 */

import { NextResponse } from 'next/server'

export async function GET() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'
  let dbStatus = 'unknown'

  try {
    const res = await fetch(`${API_BASE}/api/health`, {
      signal: AbortSignal.timeout(3000),
    })
    if (res.ok) {
      dbStatus = 'connected'
    } else {
      dbStatus = 'error'
    }
  } catch {
    dbStatus = 'unreachable'
  }

  // Verify TS engine loads
  let tsEngineStatus = 'unknown'
  try {
    const { BUILTIN_RULES } = await import('@/lib/rules/builtins')
    tsEngineStatus = `loaded:${BUILTIN_RULES.length}_rules`
  } catch {
    tsEngineStatus = 'error'
  }

  return NextResponse.json({
    ok: true,
    app: 'healthy',
    db: dbStatus,
    ts_engine: tsEngineStatus,
    timestamp: new Date().toISOString(),
  })
}
