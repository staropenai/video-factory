/**
 * lib/auth/identity.ts
 *
 * Resolves the caller's identity from the current request context.
 *
 * WHAT "authenticated" MEANS HERE
 * ---------------------------------
 * Phase 1 (now):  A user is "authenticated" if they have a valid
 *                 jtg_auth_token cookie set by POST /api/auth/login.
 *                 The token is a signed JWT containing { uid, email?, phone? }.
 *
 * Phase 2 (later): Replace with a real session system (NextAuth, Clerk, etc.)
 *                  The interface of this module stays the same.
 *
 * COOKIE NAMES
 *   jtg_uid        — anonymous identity (httpOnly, always present)
 *   jtg_auth_token — signed JWT, present only after login/contact capture
 */

import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { SignJWT, jwtVerify } from "jose";

// --- Config ---

const UID_COOKIE = "jtg_uid";
const AUTH_COOKIE = "jtg_auth_token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/**
 * JWT secret — MUST be set in environment.
 * Fallback is only for local dev; production will throw if missing.
 */
function getSecret(): Uint8Array {
  const secret = process.env.JTG_JWT_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("JTG_JWT_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(
    secret ?? "dev-only-insecure-secret-change-me"
  );
}

// --- Types ---

export interface Identity {
  uid: string;
  isAuthenticated: boolean;
  /** Present if user has provided contact info */
  email?: string;
  phone?: string;
}

export interface AuthTokenPayload {
  uid: string;
  email?: string;
  phone?: string;
}

// --- Core functions ---

/**
 * Resolve the caller's identity from cookies.
 * Always returns a valid Identity — anonymous users get a new UID.
 *
 * NOTE: This does NOT set cookies. The API route is responsible for
 *       calling setUidCookie() when isNew === true.
 */
export async function resolveIdentity(): Promise<
  Identity & { isNewUid: boolean }
> {
  const cookieStore = await cookies();

  // Step 1: resolve UID
  const existingUid = cookieStore.get(UID_COOKIE)?.value;
  const isNewUid = !existingUid || existingUid.length < 8;
  const uid = isNewUid ? randomUUID() : existingUid!;

  // Step 2: check auth token
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) {
    return { uid, isAuthenticated: false, isNewUid };
  }

  try {
    const { payload } = await jwtVerify(token, getSecret());
    const claims = payload as unknown as AuthTokenPayload;
    return {
      uid: claims.uid ?? uid,
      isAuthenticated: true,
      email: claims.email,
      phone: claims.phone,
      isNewUid: false,
    };
  } catch {
    // Token invalid or expired — treat as anonymous
    return { uid, isAuthenticated: false, isNewUid };
  }
}

/**
 * Issue a signed auth token for a user who has provided contact info.
 * Returns the token string — the caller sets the cookie.
 */
export async function issueAuthToken(
  payload: AuthTokenPayload
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("365d")
    .sign(getSecret());
}

/**
 * Build the Set-Cookie header values for UID and auth cookies.
 */
export function buildCookieOptions(maxAge = COOKIE_MAX_AGE) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge,
  };
}
