/**
 * V5 T5: Evidence records reconciliation tests.
 *
 * Validates that:
 *   1. Every request that writes an evidence record can be read back
 *   2. The record count matches the write count (no silent drops)
 *   3. Each record contains required V5 fields (ttft_ms, kb_hit, tier)
 *   4. Write failures are surfaced (ω5 compliance)
 *   5. Corrupt lines don't break the read pipeline
 */

import fs from "node:fs";
import path from "node:path";
import {
  createEvidenceRecord,
  logEvidenceRecord,
  readEvidenceChain,
  type EvidenceChainRecord,
} from "../evidence-chain-logger";

// The logger writes to .data/evidence_chain.jsonl (or /tmp on Vercel)
const DATA_DIR = path.join(process.cwd(), ".data");
const EVIDENCE_FILE = path.join(DATA_DIR, "evidence_chain.jsonl");

// Backup and restore the real file around tests
let originalContent: string | null = null;

beforeAll(() => {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  try {
    originalContent = fs.readFileSync(EVIDENCE_FILE, "utf8");
  } catch {
    originalContent = null;
  }
});

afterAll(() => {
  // Restore original content
  if (originalContent !== null) {
    fs.writeFileSync(EVIDENCE_FILE, originalContent, "utf8");
  } else {
    try {
      fs.unlinkSync(EVIDENCE_FILE);
    } catch {
      // ok
    }
  }
});

beforeEach(() => {
  // Start each test with an empty evidence file
  try {
    fs.writeFileSync(EVIDENCE_FILE, "", "utf8");
  } catch {
    // ok
  }
});

function makeRecord(overrides: Partial<{
  queryId: string;
  tier: EvidenceChainRecord["tier"];
  kb_hit: boolean;
  ttft_ms: number;
  llm_called: boolean;
  matched_keyword: string;
  confidence_score: number;
}> = {}): EvidenceChainRecord {
  const base = createEvidenceRecord({
    module: "routing",
    queryId: overrides.queryId ?? `q-${Math.random().toString(36).slice(2)}`,
    sessionId: "test-session",
    input: {
      queryText: "test query",
      userLanguage: "en",
      scenarioTag: null,
    },
    routeTaken: "L1_STATIC",
    decisionReasonCode: "L1_SEMANTIC_HIT",
    decisionReasonDetails: { test: true },
    evidenceUsed: ["faq-001"],
    triggerScore: 0.85,
    answerType: "L1",
    timeToFirstActionMs: overrides.ttft_ms ?? 42,
  });
  base.ttft_ms = overrides.ttft_ms ?? 42;
  base.kb_hit = overrides.kb_hit ?? true;
  base.tier = overrides.tier ?? "A";
  base.llm_called = overrides.llm_called ?? false;
  base.confidence_score = overrides.confidence_score ?? 0.85;
  if (overrides.matched_keyword) base.matched_keyword = overrides.matched_keyword;
  return base;
}

describe("T5: evidence_records reconciliation", () => {
  it("write N records → read N records (zero loss)", () => {
    const N = 20;
    const queryIds: string[] = [];

    for (let i = 0; i < N; i++) {
      const qid = `recon-${i}`;
      queryIds.push(qid);
      const record = makeRecord({ queryId: qid, ttft_ms: 10 + i });
      const ok = logEvidenceRecord(record);
      expect(ok).toBe(true);
    }

    const records = readEvidenceChain();
    expect(records.length).toBe(N);

    // Verify all query IDs are present
    const readIds = records.map((r) => r.queryId);
    for (const qid of queryIds) {
      expect(readIds).toContain(qid);
    }
  });

  it("each record contains V5 required fields: ttft_ms, kb_hit, tier", () => {
    const record = makeRecord({ ttft_ms: 55, kb_hit: true, tier: "B" });
    logEvidenceRecord(record);

    const records = readEvidenceChain();
    expect(records.length).toBe(1);
    const r = records[0];
    expect(typeof r.ttft_ms).toBe("number");
    expect(r.ttft_ms).toBe(55);
    expect(typeof r.kb_hit).toBe("boolean");
    expect(r.kb_hit).toBe(true);
    expect(r.tier).toBe("B");
  });

  it("ttft_ms is a non-negative integer for all tiers", () => {
    const tiers: Array<EvidenceChainRecord["tier"]> = ["A", "B", "C"];
    for (const tier of tiers) {
      const record = makeRecord({ tier, ttft_ms: tier === "C" ? 800 : 30 });
      logEvidenceRecord(record);
    }

    const records = readEvidenceChain();
    expect(records.length).toBe(3);
    for (const r of records) {
      expect(r.ttft_ms).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(r.ttft_ms)).toBe(true);
    }
  });

  it("corrupt line does not affect valid records", () => {
    // Write a valid record
    const rec1 = makeRecord({ queryId: "valid-1" });
    logEvidenceRecord(rec1);

    // Inject a corrupt line directly
    fs.appendFileSync(EVIDENCE_FILE, "NOT_VALID_JSON\n", "utf8");

    // Write another valid record
    const rec2 = makeRecord({ queryId: "valid-2" });
    logEvidenceRecord(rec2);

    const records = readEvidenceChain();
    // Should have exactly 2 valid records (corrupt line skipped)
    expect(records.length).toBe(2);
    expect(records[0].queryId).toBe("valid-1");
    expect(records[1].queryId).toBe("valid-2");
  });

  it("records maintain chronological order", () => {
    for (let i = 0; i < 5; i++) {
      const record = makeRecord({ queryId: `order-${i}` });
      logEvidenceRecord(record);
    }

    const records = readEvidenceChain();
    for (let i = 1; i < records.length; i++) {
      expect(new Date(records[i].timestamp).getTime())
        .toBeGreaterThanOrEqual(new Date(records[i - 1].timestamp).getTime());
    }
  });

  it("kb_hit=false and tier=C for Tier C records", () => {
    const record = makeRecord({ tier: "C", kb_hit: false, ttft_ms: 900 });
    logEvidenceRecord(record);

    const records = readEvidenceChain();
    expect(records[0].kb_hit).toBe(false);
    expect(records[0].tier).toBe("C");
  });

  it("logEvidenceRecord returns boolean (never throws)", () => {
    const record = makeRecord();
    const result = logEvidenceRecord(record);
    expect(typeof result).toBe("boolean");
  });

  it("V6 patent fields: llm_called, matched_keyword, confidence_score", () => {
    // Tier A: KB hit, no LLM call
    const recA = makeRecord({
      tier: "A",
      kb_hit: true,
      llm_called: false,
      matched_keyword: "hanko",
      confidence_score: 0.92,
      ttft_ms: 12,
    });
    logEvidenceRecord(recA);

    // Tier C: LLM call
    const recC = makeRecord({
      tier: "C",
      kb_hit: false,
      llm_called: true,
      confidence_score: 0.3,
      ttft_ms: 1200,
    });
    logEvidenceRecord(recC);

    const records = readEvidenceChain();
    expect(records.length).toBe(2);

    // Tier A record
    expect(records[0].llm_called).toBe(false);
    expect(records[0].matched_keyword).toBe("hanko");
    expect(records[0].confidence_score).toBe(0.92);

    // Tier C record
    expect(records[1].llm_called).toBe(true);
    expect(records[1].matched_keyword).toBeUndefined();
    expect(records[1].confidence_score).toBe(0.3);
  });

  it("V6 patent invariant: llm_called=false implies kb_hit=true", () => {
    const rec = makeRecord({ llm_called: false, kb_hit: true, tier: "A" });
    logEvidenceRecord(rec);

    const records = readEvidenceChain();
    const r = records[0];
    // When llm_called is false, kb_hit must be true (routing avoided LLM)
    if (r.llm_called === false) {
      expect(r.kb_hit).toBe(true);
      expect(["A", "B"]).toContain(r.tier);
    }
  });
});
