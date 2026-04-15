/**
 * lib/utils/api-response.ts — Standardized API response helpers.
 *
 * Provides consistent JSON response shapes across all API routes.
 */

import { NextResponse } from "next/server";

/** Success response with data payload. */
export const ok = <T>(data: T, status = 200) =>
  NextResponse.json({ success: true, data }, { status });

/** Error response with message and optional error code. */
export const fail = (message: string, status = 400, code?: string) =>
  NextResponse.json(
    { success: false, error: message, ...(code ? { code } : {}) },
    { status }
  );

/** 401 Unauthorized. */
export const unauthorized = () =>
  NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

/** 404 Not Found. */
export const notFound = (resource = "Resource") =>
  NextResponse.json(
    { success: false, error: `${resource} not found` },
    { status: 404 }
  );

/** 429 Rate Limited. */
export const rateLimited = (retryAfterSec: number) =>
  NextResponse.json(
    { success: false, error: "Too many requests", retryAfter: retryAfterSec },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
  );
