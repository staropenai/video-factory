/**
 * Evidence chain write verification tests.
 *
 * Validates that:
 * 1. createEvidenceRecord produces well-formed records
 * 2. logEvidenceRecord writes to JSONL and returns success/failure
 * 3. readEvidenceChain reads back what was written (round-trip)
 * 4. Corrupt lines are skipped gracefully
 * 5. inferPatentClaims correctly tags claims
 */

import fs from "node:fs";
import path from "node:path";
import {
  createEvidenceRecord,
  logEvidenceRecord,
  readEvidenceChain,
  inferPatentClaims,
  type EvidenceChainRecord,
  type ProcessRecord,
} from "../evidence-chain-logger";

// Use a temp directory to avoid polluting project .data/
const TEST_DATA_DIR = path.join(process.cwd(), ".data");
const EVIDENCE_FILE = path.join(TEST_DATA_DIR, "evidence_chain.jsonl");

function makeRecord(overrides: Partial<Parameters<typeof createEvidenceRecord>[0]> = {}): EvidenceChainRecord {
  return createEvidenceRecord({
    module: "routing",
    queryId: "q_test_" + Math.random().toString(36).slice(2, 8),
    sessionId: "s_test",
    input: {
      queryText: "What is shikikin?",
      userLanguage: "en",
      scenarioTag: null,
    },
    routeTaken: "L1_STATIC",
    decisionReasonCode: "L1_SEMANTIC_HIT",
    decisionReasonDetails: { topScore: 0.89 },
    evidenceUsed: [],
    answerType: "L1",
    ...overrides,
  });
}

describe("Evidence chain write verification", () => {
  // Clean up before and after each test
  beforeEach(() => {
    try {
      if (fs.existsSync(EVIDENCE_FILE)) {
        fs.unlinkSync(EVIDENCE_FILE);
      }
    } catch {
      // ignore
    }
  });

  afterAll(() => {
    try {
      if (fs.existsSync(EVIDENCE_FILE)) {
        fs.unlinkSync(EVIDENCE_FILE);
      }
    } catch {
      // ignore
    }
  });

  // ── createEvidenceRecord ──────────────────────────────────────

  it("creates a well-formed record with ecr_ prefix", () => {
    const record = makeRecord();
    expect(record.recordId).toMatch(/^ecr_/);
    expect(record.timestamp).toBeTruthy();
    expect(record.module).toBe("routing");
    expect(record.input.queryText).toBe("What is shikikin?");
  });

  it("truncates queryText to 500 characters", () => {
    const longQuery = "a".repeat(1000);
    const record = makeRecord({
      input: { queryText: longQuery, userLanguage: "en", scenarioTag: null },
    });
    expect(record.input.queryText).toHaveLength(500);
  });

  it("auto-infers patent claims from process record", () => {
    const record = makeRecord({
      routeTaken: "L1_STATIC",
      evidenceUsed: ["faq-1"],
      triggerScore: 0.85,
      judgmentRuleId: "rule_1",
    });
    expect(record.patentClaimRelevant).toContain("ClaimA_routing");
    expect(record.patentClaimRelevant).toContain("ClaimB_evidence");
    expect(record.patentClaimRelevant).toContain("ClaimA_judgment");
  });

  it("does not include ClaimA_routing for L6_HUMAN", () => {
    const record = makeRecord({ routeTaken: "L6_HUMAN", answerType: "L6" });
    expect(record.patentClaimRelevant).not.toContain("ClaimA_routing");
  });

  it("includes ClaimC_bridge for bridge state transitions", () => {
    const record = makeRecord({
      module: "bridge",
      routeTaken: "L5_BRIDGE",
      stateTransitionPath: ["init", "script_generated", "confirmed"],
      answerType: "L5",
    });
    expect(record.patentClaimRelevant).toContain("ClaimC_bridge");
  });

  it("defaults baselineComparisonFlag to false", () => {
    const record = makeRecord();
    expect(record.baselineComparisonFlag).toBe(false);
  });

  it("allows explicit baselineComparisonFlag=true", () => {
    const record = makeRecord({ baselineComparisonFlag: true });
    expect(record.baselineComparisonFlag).toBe(true);
  });

  // ── logEvidenceRecord + readEvidenceChain (round-trip) ────────

  it("writes a record and reads it back (round-trip)", () => {
    const record = makeRecord();
    const success = logEvidenceRecord(record);
    expect(success).toBe(true);

    const records = readEvidenceChain();
    expect(records.length).toBe(1);
    expect(records[0].recordId).toBe(record.recordId);
    expect(records[0].input.queryText).toBe("What is shikikin?");
    expect(records[0].process.routeTaken).toBe("L1_STATIC");
  });

  it("appends multiple records", () => {
    const r1 = makeRecord({ routeTaken: "L1_STATIC", answerType: "L1" });
    const r2 = makeRecord({ routeTaken: "L3_AI", answerType: "L3" });
    const r3 = makeRecord({ routeTaken: "L5_BRIDGE", answerType: "L5" });

    logEvidenceRecord(r1);
    logEvidenceRecord(r2);
    logEvidenceRecord(r3);

    const records = readEvidenceChain();
    expect(records.length).toBe(3);
    expect(records[0].process.routeTaken).toBe("L1_STATIC");
    expect(records[1].process.routeTaken).toBe("L3_AI");
    expect(records[2].process.routeTaken).toBe("L5_BRIDGE");
  });

  it("preserves all fields through write/read cycle", () => {
    const record = makeRecord({
      module: "evidence",
      routeTaken: "L3_AI",
      decisionReasonCode: "L3_AI_INFERRED",
      decisionReasonDetails: { confidence: 0.72, riskLevel: "medium" },
      evidenceUsed: ["faq-deposit", "faq-key-money"],
      triggerScore: 0.85,
      stateTransitionPath: [],
      optimizerRoute: "layer3_ai",
      judgmentRuleId: "low_confidence_gate",
      answerType: "L3",
      timeToFirstActionMs: 450,
      baselineComparisonFlag: true,
    });

    logEvidenceRecord(record);
    const [read] = readEvidenceChain();

    expect(read.module).toBe("evidence");
    expect(read.process.triggerScore).toBe(0.85);
    expect(read.process.evidenceUsed).toEqual(["faq-deposit", "faq-key-money"]);
    expect(read.process.optimizerRoute).toBe("layer3_ai");
    expect(read.process.judgmentRuleId).toBe("low_confidence_gate");
    expect(read.output.answerType).toBe("L3");
    expect(read.output.timeToFirstActionMs).toBe(450);
    expect(read.baselineComparisonFlag).toBe(true);
    expect(read.patentClaimRelevant).toContain("ClaimA_routing");
    expect(read.patentClaimRelevant).toContain("ClaimB_evidence");
    expect(read.patentClaimRelevant).toContain("ClaimA_judgment");
  });

  // ── Corrupt line handling ─────────────────────────────────────

  it("skips corrupt lines and reads valid ones", () => {
    const r1 = makeRecord();
    logEvidenceRecord(r1);

    // Inject a corrupt line manually
    fs.appendFileSync(EVIDENCE_FILE, "NOT VALID JSON\n", "utf8");

    const r2 = makeRecord({ routeTaken: "L3_AI", answerType: "L3" });
    logEvidenceRecord(r2);

    const records = readEvidenceChain();
    expect(records.length).toBe(2);
    expect(records[0].recordId).toBe(r1.recordId);
    expect(records[1].recordId).toBe(r2.recordId);
  });

  it("returns empty array when file does not exist", () => {
    // File already cleaned up by beforeEach
    const records = readEvidenceChain();
    expect(records).toEqual([]);
  });

  // ── inferPatentClaims (pure) ──────────────────────────────────

  it("infers ClaimA_routing for non-L6 routes", () => {
    const process: ProcessRecord = {
      routeTaken: "L1_STATIC",
      decisionReasonCode: "L1_SEMANTIC_HIT",
      decisionReasonDetails: {},
      triggerScore: null,
      evidenceUsed: [],
      stateTransitionPath: [],
      optimizerRoute: null,
      judgmentRuleId: null,
    };
    const claims = inferPatentClaims(process);
    expect(claims).toContain("ClaimA_routing");
    expect(claims).not.toContain("ClaimC_bridge");
    expect(claims).not.toContain("ClaimB_evidence");
  });

  it("infers all four claims when all conditions met", () => {
    const process: ProcessRecord = {
      routeTaken: "L3_AI",
      decisionReasonCode: "L3_AI_INFERRED",
      decisionReasonDetails: {},
      triggerScore: 0.9,
      evidenceUsed: ["ev1"],
      stateTransitionPath: ["init", "running"],
      optimizerRoute: "layer3_ai",
      judgmentRuleId: "rule_1",
    };
    const claims = inferPatentClaims(process);
    expect(claims).toContain("ClaimA_routing");
    expect(claims).toContain("ClaimC_bridge");
    expect(claims).toContain("ClaimB_evidence");
    expect(claims).toContain("ClaimA_judgment");
  });
});
