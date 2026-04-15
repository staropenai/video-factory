/**
 * src/lib/routing/kb-matcher.ts
 *
 * Knowledge base hit predicates — V5 T1.
 * maturity: transitional (thresholds need tuning from production data)
 *
 * Wraps the existing `retrieveFromLocal()` + `TIER_BY_SUBTOPIC` logic
 * behind a clean predicate interface. All functions are pure — no I/O,
 * no side effects.
 *
 * notEquivalentTo:
 *   - Not a semantic search engine (keyword matching only)
 *   - Thresholds are initial values, not production-validated
 *   - Does not replace retrieveFromLocal() — wraps it for V5 compliance
 */

import { retrieveFromLocal } from "@/lib/knowledge/retrieve";
import type { LocalizedText } from "@/lib/knowledge/seed";

// =====================================================================
// Types
// =====================================================================

export interface KBMatchResult {
  hit: boolean;
  tier: "A" | "B" | "C";
  confidence: number; // [0, 1]
  cardId: string | null;
  content: string | null;
  language: string;
}

// =====================================================================
// Predicates — pure functions, no side effects
// =====================================================================

/**
 * Predicate P_A: Tier A keyword match.
 * True when the retrieval engine returns a tier_a_shortcut with
 * score >= TIER_SHORTCUT_MIN_SCORE (0.77).
 */
export function matchTierA(shortcut: string, topScore: number): boolean {
  return shortcut === "tier_a_shortcut" && topScore >= getTierBThreshold();
}

/**
 * Predicate P_B: Tier B procedural FAQ match.
 * True when the retrieval engine returns a tier_b_shortcut with
 * score >= configured threshold.
 */
export function matchTierB(shortcut: string, topScore: number): boolean {
  return shortcut === "tier_b_shortcut" && topScore >= getTierBThreshold();
}

/**
 * Predicate P_KB: P_A ∨ P_B — any knowledge base shortcut hit.
 */
export function isKBHit(result: {
  shortcut: string | undefined;
  topScore: number;
}): boolean {
  const sc = result.shortcut ?? "none";
  return matchTierA(sc, result.topScore) || matchTierB(sc, result.topScore);
}

/**
 * Threshold for Tier B confidence. Reads from env or defaults to 0.77
 * (matching the existing TIER_SHORTCUT_MIN_SCORE in retrieve.ts).
 */
function getTierBThreshold(): number {
  return Number(process.env.KB_TIER_B_THRESHOLD ?? "0.77");
}

// =====================================================================
// High-level matcher — delegates to retrieveFromLocal()
// =====================================================================

/**
 * Match a query against the knowledge base and return a structured result.
 * This is a synchronous, ~1ms operation (keyword scoring only).
 */
export function matchKnowledgeBase(
  query: string,
  language = "en"
): KBMatchResult {
  const retrieval = retrieveFromLocal(query);
  const { shortcut, topScore } = retrieval.summary;
  const topMatch = retrieval.matches[0] ?? null;
  const sc = shortcut ?? "none";

  if (isKBHit({ shortcut: sc, topScore }) && topMatch) {
    const tier: "A" | "B" = sc === "tier_a_shortcut" ? "A" : "B";
    const langKey = language as keyof LocalizedText;
    return {
      hit: true,
      tier,
      confidence: topScore,
      cardId: topMatch.id,
      content: topMatch.standard_answer[langKey] ?? topMatch.standard_answer.en ?? null,
      language,
    };
  }

  return {
    hit: false,
    tier: "C",
    confidence: topScore,
    cardId: null,
    content: null,
    language,
  };
}
