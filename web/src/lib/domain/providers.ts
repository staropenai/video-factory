/**
 * JTG P1 — External provider envelope + registry stub.
 *
 * Any time we pull data from a live external source (property listings,
 * city-hall announcements, exchange rates, etc.) the result comes back
 * wrapped in a ProviderEnvelope so downstream layers get consistent
 * provenance. The envelope enforces:
 *
 *   1. sourceType must be 'REALTIME'
 *   2. fetchedAt is required and must be a parseable ISO-8601 string
 *   3. sourceName is required so users can see "via HOME'S" etc.
 *
 * validateProviderEnvelope is called at the boundary — nothing downstream
 * trusts an unvalidated envelope. The P1 test suite hits both pass and
 * fail cases.
 *
 * PROVIDER_REGISTRY is intentionally EMPTY. We don't ship fake provider
 * integrations; every provider is a real adapter the staff wires in when
 * the data source becomes available. Keeping the registry empty but typed
 * means the router can call `PROVIDER_REGISTRY.property` without guards.
 */

import type { SourceType } from './enums'

// ---------------------------------------------------------------------
// Envelope.
// ---------------------------------------------------------------------

export interface ProviderEnvelope<T> {
  /** Must be REALTIME — validator enforces. */
  sourceType: Extract<SourceType, 'REALTIME'>
  sourceName: string
  /** ISO-8601 timestamp of when THIS payload was fetched. */
  fetchedAt: string
  /** Optional TTL hint; if set and in the past, freshnessWarning must be true. */
  expiresAt?: string
  freshnessWarning: boolean
  payload: T
}

export const PROVIDER_ERROR_CODES = {
  WRONG_SOURCE_TYPE: 'WRONG_SOURCE_TYPE',
  MISSING_TIMESTAMP: 'MISSING_TIMESTAMP',
  MISSING_SOURCE_NAME: 'MISSING_SOURCE_NAME',
  INVALID_TIMESTAMP: 'INVALID_TIMESTAMP',
} as const
export type ProviderErrorCode =
  (typeof PROVIDER_ERROR_CODES)[keyof typeof PROVIDER_ERROR_CODES]

export interface ProviderValidationOk<T> {
  ok: true
  envelope: ProviderEnvelope<T>
}
export interface ProviderValidationErr {
  ok: false
  code: ProviderErrorCode
  message: string
}
export type ProviderValidationResult<T> =
  | ProviderValidationOk<T>
  | ProviderValidationErr

export function validateProviderEnvelope<T>(
  env: Partial<ProviderEnvelope<T>> & { sourceType?: string },
): ProviderValidationResult<T> {
  if (env.sourceType !== 'REALTIME') {
    return {
      ok: false,
      code: PROVIDER_ERROR_CODES.WRONG_SOURCE_TYPE,
      message: `sourceType must be REALTIME; got ${JSON.stringify(env.sourceType)}`,
    }
  }
  if (!env.sourceName) {
    return {
      ok: false,
      code: PROVIDER_ERROR_CODES.MISSING_SOURCE_NAME,
      message: 'sourceName is required',
    }
  }
  if (!env.fetchedAt) {
    return {
      ok: false,
      code: PROVIDER_ERROR_CODES.MISSING_TIMESTAMP,
      message: 'fetchedAt is required on every REALTIME envelope',
    }
  }
  if (!Number.isFinite(Date.parse(env.fetchedAt))) {
    return {
      ok: false,
      code: PROVIDER_ERROR_CODES.INVALID_TIMESTAMP,
      message: `fetchedAt is not a valid ISO-8601 timestamp: ${env.fetchedAt}`,
    }
  }
  return {
    ok: true,
    envelope: {
      sourceType: 'REALTIME',
      sourceName: env.sourceName,
      fetchedAt: env.fetchedAt,
      expiresAt: env.expiresAt,
      freshnessWarning: Boolean(env.freshnessWarning),
      payload: env.payload as T,
    },
  }
}

// ---------------------------------------------------------------------
// Property provider shape + UI mapping.
// ---------------------------------------------------------------------

export interface PropertyListing {
  listingId: string
  title: string
  monthlyRent: number
  currency: 'JPY'
  addressHint: string
  url: string
}

export interface PropertyProvider {
  name: string
  fetchListings(filter: {
    city?: string
    maxRent?: number
    limit?: number
  }): Promise<ProviderEnvelope<PropertyListing[]>>
}

export interface OfficialDataProvider {
  name: string
  fetchAnnouncements(filter: {
    topic?: string
    since?: string
  }): Promise<ProviderEnvelope<Array<{ title: string; body: string; url: string }>>>
}

/**
 * Empty registry. Real adapters get pushed here when they're implemented;
 * the router reads `PROVIDER_REGISTRY.property` / `.official` and degrades
 * gracefully when either list is empty (returns zero REALTIME blocks).
 */
export const PROVIDER_REGISTRY: {
  property: PropertyProvider[]
  official: OfficialDataProvider[]
} = {
  property: [],
  official: [],
}

/**
 * UI shape for a property answer block. Decoupled from PropertyListing so
 * the UI can be refactored without forcing every provider adapter to
 * change. `sourceType` is pinned to REALTIME so the answer-payload
 * validator stays happy.
 */
export interface PropertyAnswerBlock {
  kind: 'PROPERTY_LISTING'
  sourceType: Extract<SourceType, 'REALTIME'>
  sourceName: string
  fetchedAt: string
  freshnessWarning: boolean
  title: string
  monthlyRentLabel: string
  addressHint: string
  url: string
}

export function mapPropertyToAnswerBlock(
  env: ProviderEnvelope<PropertyListing[]>,
  listing: PropertyListing,
): PropertyAnswerBlock {
  return {
    kind: 'PROPERTY_LISTING',
    sourceType: 'REALTIME',
    sourceName: env.sourceName,
    fetchedAt: env.fetchedAt,
    freshnessWarning: env.freshnessWarning,
    title: listing.title,
    monthlyRentLabel: `¥${listing.monthlyRent.toLocaleString('ja-JP')}`,
    addressHint: listing.addressHint,
    url: listing.url,
  }
}
