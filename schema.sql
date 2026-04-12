-- ============================================================
-- Foreigner Housing OS · V2.0 — Master-Plan-Aligned Schema
-- Target: SQLite 3.38+
-- Aligned with: StartOpenAI_strategy_product_data_master
-- ============================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ============================================================
-- 1. FAQ ITEMS (Layer 1: Static Knowledge Database)
-- ============================================================
CREATE TABLE IF NOT EXISTS faq_items (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    faq_slug               TEXT    NOT NULL UNIQUE,
    title                  TEXT    NOT NULL,
    question               TEXT,
    short_answer           TEXT,
    content                TEXT,
    content_version        INTEGER NOT NULL DEFAULT 1,
    category               TEXT,
    language               TEXT    NOT NULL DEFAULT 'en'
                           CHECK (language IN ('en','zh','ja')),
    risk_level             TEXT    NOT NULL DEFAULT 'low'
                           CHECK (risk_level IN ('low','medium','high')),
    applicability_boundary TEXT,
    dynamic_dependency     TEXT,
    requires_human         INTEGER NOT NULL DEFAULT 0 CHECK (requires_human IN (0,1)),
    review_status          TEXT    NOT NULL DEFAULT 'draft'
                           CHECK (review_status IN (
                               'draft','in_review','approved','stale','deprecated'
                           )),
    router_callable        INTEGER NOT NULL DEFAULT 0 CHECK (router_callable IN (0,1)),
    regression_coverable   INTEGER NOT NULL DEFAULT 0 CHECK (regression_coverable IN (0,1)),
    created_at             TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at             TEXT    NOT NULL DEFAULT (datetime('now')),
    last_reviewed_at       TEXT,
    reviewer_note          TEXT
);
CREATE INDEX IF NOT EXISTS idx_faq_review   ON faq_items(review_status);
CREATE INDEX IF NOT EXISTS idx_faq_callable ON faq_items(router_callable);
CREATE INDEX IF NOT EXISTS idx_faq_category ON faq_items(category);
CREATE INDEX IF NOT EXISTS idx_faq_lang     ON faq_items(language);

-- ============================================================
-- 2. SOURCE REGISTRY
-- ============================================================
CREATE TABLE IF NOT EXISTS source_registry (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    source_key       TEXT    NOT NULL UNIQUE,
    source_type      TEXT    NOT NULL DEFAULT 'document'
                     CHECK (source_type IN (
                         'document','api','database','human_expert',
                         'external_system','internal_policy'
                     )),
    source_name      TEXT    NOT NULL,
    source_url       TEXT,
    description      TEXT,
    publisher        TEXT,
    language         TEXT    DEFAULT 'ja',
    region           TEXT    DEFAULT 'japan_nationwide',
    source_date      TEXT,
    freshness_policy TEXT    DEFAULT 'manual'
                     CHECK (freshness_policy IN (
                         'manual','daily','weekly','monthly','realtime'
                     )),
    last_verified_at TEXT,
    review_status    TEXT    NOT NULL DEFAULT 'pending'
                     CHECK (review_status IN ('pending','reviewed','stale','conflict')),
    staleness_status TEXT    NOT NULL DEFAULT 'current'
                     CHECK (staleness_status IN ('current','stale','unknown')),
    trust_level      TEXT    NOT NULL DEFAULT 'secondary'
                     CHECK (trust_level IN ('primary','secondary','external')),
    notes            TEXT,
    is_active        INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
    created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- 3. FAQ SOURCE MAPPINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS faq_source_mappings (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    faq_slug               TEXT    NOT NULL,
    source_key             TEXT    NOT NULL,
    mapping_status         TEXT    NOT NULL DEFAULT 'active'
                           CHECK (mapping_status IN ('active','deprecated','pending_review')),
    review_status          TEXT    NOT NULL DEFAULT 'pending'
                           CHECK (review_status IN ('pending','reviewed','rejected','stale')),
    applicability_boundary TEXT,
    stale_flag             INTEGER NOT NULL DEFAULT 0 CHECK (stale_flag IN (0,1)),
    last_reviewed_at       TEXT,
    reviewer_note          TEXT,
    created_at             TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at             TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(faq_slug, source_key),
    FOREIGN KEY (faq_slug)   REFERENCES faq_items(faq_slug),
    FOREIGN KEY (source_key) REFERENCES source_registry(source_key)
);
CREATE INDEX IF NOT EXISTS idx_fsm_stale  ON faq_source_mappings(stale_flag) WHERE stale_flag=1;
CREATE INDEX IF NOT EXISTS idx_fsm_review ON faq_source_mappings(review_status);

-- ============================================================
-- 4. RULES CATALOG (Layer 2: NLPM Testable Rules)
-- ============================================================
CREATE TABLE IF NOT EXISTS rules_catalog (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_key              TEXT    NOT NULL,
    rule_version          INTEGER NOT NULL DEFAULT 1,
    title                 TEXT    NOT NULL,
    description           TEXT,
    category              TEXT,
    rule_type             TEXT    NOT NULL DEFAULT 'routing'
                          CHECK (rule_type IN (
                              'routing','confidence','escalation',
                              'clarification','output_mode','cost'
                          )),
    rule_body             TEXT    NOT NULL,
    required_inputs       TEXT,
    optional_inputs       TEXT,
    outputs               TEXT,
    fallback_mode         TEXT    DEFAULT 'clarify'
                          CHECK (fallback_mode IN ('clarify','official_only','handoff','block')),
    conflict_policy       TEXT    DEFAULT 'escalate'
                          CHECK (conflict_policy IN ('escalate','most_restrictive','manual')),
    human_override_allowed INTEGER NOT NULL DEFAULT 1 CHECK (human_override_allowed IN (0,1)),
    intent_patterns       TEXT,
    test_cases            TEXT,
    risk_level            TEXT    NOT NULL DEFAULT 'low'
                          CHECK (risk_level IN ('low','medium','high')),
    is_active             INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
    effective_from        TEXT,
    effective_until       TEXT,
    created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at            TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(rule_key, rule_version)
);
CREATE INDEX IF NOT EXISTS idx_rules_active ON rules_catalog(is_active, rule_key);
CREATE INDEX IF NOT EXISTS idx_rules_type   ON rules_catalog(rule_type);

-- ============================================================
-- 5. USER TASK STATE (Layer 3: User Task State Data)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_task_state (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id          TEXT    NOT NULL UNIQUE,
    current_stage       TEXT    NOT NULL DEFAULT 'initial'
                        CHECK (current_stage IN (
                            'initial','before_japan','just_arrived',
                            'renting_now','moving_in','contract_trouble',
                            'completed'
                        )),
    language_pref       TEXT    DEFAULT 'en' CHECK (language_pref IN ('en','zh','ja')),
    visa_status         TEXT,
    budget_range        TEXT,
    target_area         TEXT,
    commute_target      TEXT,
    move_in_date        TEXT,
    guarantor_status    TEXT    CHECK (guarantor_status IS NULL OR guarantor_status IN (
                            'has_japanese_guarantor','needs_company','unknown'
                        )),
    jp_language_level   TEXT    CHECK (jp_language_level IS NULL OR jp_language_level IN (
                            'none','basic','conversational','business','native'
                        )),
    employment_status   TEXT,
    current_blocker     TEXT,
    current_answer_mode TEXT,
    requires_human      INTEGER NOT NULL DEFAULT 0 CHECK (requires_human IN (0,1)),
    decision_ids        TEXT,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_uts_stage ON user_task_state(current_stage);

-- ============================================================
-- 6. ROUTER DECISIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS router_decisions (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    decision_id             TEXT    NOT NULL UNIQUE,
    session_id              TEXT,
    query_text              TEXT    NOT NULL,
    query_type              TEXT    NOT NULL
                            CHECK (query_type IN (
                                'faq','formula','checklist','dynamic',
                                'case_specific','out_of_scope'
                            )),
    risk_level              TEXT    NOT NULL DEFAULT 'low'
                            CHECK (risk_level IN ('low','medium','high')),
    confidence_band         TEXT    NOT NULL DEFAULT 'high'
                            CHECK (confidence_band IN ('high','medium','low')),
    selected_rule_keys      TEXT,
    selected_rule_versions  TEXT,
    selected_faq_slugs      TEXT,
    missing_inputs          TEXT,
    answer_mode             TEXT    NOT NULL DEFAULT 'direct'
                            CHECK (answer_mode IN ('direct','clarify','official_only','handoff')),
    should_escalate         INTEGER NOT NULL DEFAULT 0 CHECK (should_escalate IN (0,1)),
    decision_reason         TEXT,
    trace_tags              TEXT,
    source_issue_flags      TEXT,
    retrieval_count         INTEGER,
    source_count            INTEGER,
    source_conflict         INTEGER DEFAULT 0 CHECK (source_conflict IN (0,1)),
    source_stale            INTEGER DEFAULT 0 CHECK (source_stale IN (0,1)),
    created_at              TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rd_created    ON router_decisions(created_at);
CREATE INDEX IF NOT EXISTS idx_rd_escalate   ON router_decisions(should_escalate) WHERE should_escalate=1;
CREATE INDEX IF NOT EXISTS idx_rd_confidence ON router_decisions(confidence_band);
CREATE INDEX IF NOT EXISTS idx_rd_session    ON router_decisions(session_id);

-- ============================================================
-- 7. HUMAN ESCALATION QUEUE (Layer 4: Human Fulfillment Boundaries)
-- ============================================================
CREATE TABLE IF NOT EXISTS human_escalation_queue (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    escalation_id     TEXT    NOT NULL UNIQUE,
    decision_id       TEXT,
    session_id        TEXT,
    query_text        TEXT    NOT NULL,
    risk_level        TEXT    NOT NULL DEFAULT 'medium'
                      CHECK (risk_level IN ('low','medium','high')),
    confidence_band   TEXT    NOT NULL DEFAULT 'low'
                      CHECK (confidence_band IN ('high','medium','low')),
    escalation_reason TEXT    NOT NULL,
    priority_band     TEXT    NOT NULL DEFAULT 'normal'
                      CHECK (priority_band IN ('critical','high','normal','low')),
    sla_tier          TEXT    NOT NULL DEFAULT 'tier1'
                      CHECK (sla_tier IN ('tier1','tier2','tier3')),
    selected_faq_slugs  TEXT,
    selected_rule_keys  TEXT,
    source_issue_flags  TEXT,
    queue_status      TEXT    NOT NULL DEFAULT 'open'
                      CHECK (queue_status IN (
                          'open','assigned','in_progress',
                          'resolved','writeback_pending',
                          'closed','cancelled'
                      )),
    assigned_team     TEXT,
    assigned_to       TEXT,
    resolution_type   TEXT
                      CHECK (resolution_type IS NULL OR resolution_type IN (
                          'answered','faq_created','faq_updated',
                          'rule_created','rule_updated',
                          'out_of_scope','duplicate','no_action'
                      )),
    resolution_note   TEXT,
    writeback_actions TEXT,
    created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT    NOT NULL DEFAULT (datetime('now')),
    resolved_at       TEXT,
    closed_at         TEXT
);
CREATE INDEX IF NOT EXISTS idx_eq_status   ON human_escalation_queue(queue_status);
CREATE INDEX IF NOT EXISTS idx_eq_priority ON human_escalation_queue(priority_band, queue_status);
CREATE INDEX IF NOT EXISTS idx_eq_sla      ON human_escalation_queue(sla_tier);

-- ============================================================
-- 8. HUMAN ESCALATION EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS human_escalation_events (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id       TEXT    NOT NULL UNIQUE,
    escalation_id  TEXT    NOT NULL,
    event_type     TEXT    NOT NULL
                   CHECK (event_type IN (
                       'enqueue','assigned','viewed','in_progress',
                       'resolved','writeback_created','closed','cancelled',
                       'reassigned','note_added'
                   )),
    actor          TEXT,
    actor_type     TEXT    DEFAULT 'system'
                   CHECK (actor_type IN ('system','agent','user','router')),
    event_data     TEXT,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (escalation_id) REFERENCES human_escalation_queue(escalation_id)
);
CREATE INDEX IF NOT EXISTS idx_ee_esc  ON human_escalation_events(escalation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ee_type ON human_escalation_events(event_type);

-- ============================================================
-- 9. REGRESSION CASES
-- ============================================================
CREATE TABLE IF NOT EXISTS regression_cases (
    id                         INTEGER PRIMARY KEY AUTOINCREMENT,
    case_key                   TEXT    NOT NULL UNIQUE,
    query_text                 TEXT    NOT NULL,
    expected_query_type        TEXT    NOT NULL
                               CHECK (expected_query_type IN (
                                   'faq','formula','checklist','dynamic',
                                   'case_specific','out_of_scope'
                               )),
    expected_rule_keys         TEXT,
    expected_faq_slugs         TEXT,
    expected_confidence_band   TEXT
                               CHECK (expected_confidence_band IS NULL OR
                                      expected_confidence_band IN ('high','medium','low')),
    expected_answer_mode       TEXT
                               CHECK (expected_answer_mode IS NULL OR
                                      expected_answer_mode IN ('direct','clarify','official_only','handoff')),
    expected_should_escalate   INTEGER CHECK (expected_should_escalate IS NULL OR
                                             expected_should_escalate IN (0,1)),
    risk_level                 TEXT    NOT NULL DEFAULT 'low'
                               CHECK (risk_level IN ('low','medium','high')),
    source_origin              TEXT    NOT NULL DEFAULT 'manual'
                               CHECK (source_origin IN (
                                   'faq_seed','rule_test','escalation_resolution',
                                   'failure_fix','source_conflict','dynamic_blocked','manual'
                               )),
    created_from               TEXT,
    source_reference           TEXT,
    is_active                  INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
    created_at                 TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at                 TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rc_origin ON regression_cases(source_origin);
CREATE INDEX IF NOT EXISTS idx_rc_active ON regression_cases(is_active);

-- ============================================================
-- 10. REGRESSION RUNS
-- ============================================================
CREATE TABLE IF NOT EXISTS regression_runs (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id                  TEXT    NOT NULL,
    case_key                TEXT    NOT NULL,
    actual_decision_id      TEXT,
    actual_query_type       TEXT,
    actual_rule_keys        TEXT,
    actual_faq_slugs        TEXT,
    actual_confidence       TEXT,
    actual_answer_mode      TEXT,
    actual_should_escalate  INTEGER,
    pass_fail               TEXT    NOT NULL DEFAULT 'pending'
                            CHECK (pass_fail IN ('pass','fail','error','pending','skipped')),
    failure_details         TEXT,
    executed_at             TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(run_id, case_key),
    FOREIGN KEY (case_key) REFERENCES regression_cases(case_key)
);
CREATE INDEX IF NOT EXISTS idx_rr_run  ON regression_runs(run_id);
CREATE INDEX IF NOT EXISTS idx_rr_pf   ON regression_runs(pass_fail);

-- ============================================================
-- 11. WRITEBACK CANDIDATES (writeback_log)
-- ============================================================
CREATE TABLE IF NOT EXISTS writeback_candidates (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    writeback_id    TEXT    NOT NULL UNIQUE,
    escalation_id   TEXT    NOT NULL,
    target_type     TEXT    NOT NULL
                    CHECK (target_type IN (
                        'faq_create','faq_update',
                        'rule_create','rule_update',
                        'regression_case','source_completion',
                        'prompt_guardrail','sop_update'
                    )),
    target_key      TEXT,
    candidate_data  TEXT    NOT NULL,
    notes           TEXT,
    status          TEXT    NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected','applied','superseded')),
    approved_by     TEXT,
    applied_at      TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (escalation_id) REFERENCES human_escalation_queue(escalation_id)
);
CREATE INDEX IF NOT EXISTS idx_wb_status ON writeback_candidates(status);
CREATE INDEX IF NOT EXISTS idx_wb_esc    ON writeback_candidates(escalation_id);

-- ============================================================
-- 12. CONSULTATION RECORDS (ingestion staging for real queries)
-- ============================================================
CREATE TABLE IF NOT EXISTS consultation_records (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id       TEXT    NOT NULL UNIQUE,
    source_channel  TEXT    NOT NULL DEFAULT 'manual'
                    CHECK (source_channel IN ('manual','email','line','phone','web','internal')),
    query_text      TEXT    NOT NULL,
    query_language  TEXT    DEFAULT 'en',
    client_context  TEXT,
    visa_status     TEXT,
    resolution_text TEXT,
    resolution_type TEXT    CHECK (resolution_type IS NULL OR resolution_type IN (
                        'answered','escalated','referred','unresolved'
                    )),
    resolved_by     TEXT,
    tags            TEXT,
    faq_slug_match  TEXT,
    rule_key_match  TEXT,
    ingested_to_faq INTEGER NOT NULL DEFAULT 0 CHECK (ingested_to_faq IN (0,1)),
    ingested_to_regression INTEGER NOT NULL DEFAULT 0 CHECK (ingested_to_regression IN (0,1)),
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cr_channel ON consultation_records(source_channel);
CREATE INDEX IF NOT EXISTS idx_cr_ingested ON consultation_records(ingested_to_faq, ingested_to_regression);

-- ============================================================
-- VALIDATION VIEWS
-- ============================================================

CREATE VIEW IF NOT EXISTS v_faq_incomplete AS
SELECT f.faq_slug, f.title,
    CASE WHEN f.content IS NULL OR f.content='' THEN 1 ELSE 0 END AS missing_content,
    CASE WHEN fsm.id IS NULL THEN 1 ELSE 0 END AS missing_source,
    CASE WHEN f.review_status IN ('draft','stale') THEN 1 ELSE 0 END AS review_incomplete,
    CASE WHEN f.applicability_boundary IS NULL THEN 1 ELSE 0 END AS missing_boundary,
    f.router_callable, f.regression_coverable
FROM faq_items f
LEFT JOIN faq_source_mappings fsm
    ON fsm.faq_slug=f.faq_slug AND fsm.mapping_status='active' AND fsm.review_status='reviewed'
GROUP BY f.faq_slug
HAVING missing_content=1 OR missing_source=1 OR review_incomplete=1
    OR missing_boundary=1 OR f.router_callable=0 OR f.regression_coverable=0;

CREATE VIEW IF NOT EXISTS v_stale_mappings AS
SELECT fsm.faq_slug, fsm.source_key, sr.freshness_policy, sr.last_verified_at,
    CASE
        WHEN sr.freshness_policy='daily'   AND (sr.last_verified_at IS NULL OR julianday('now')-julianday(sr.last_verified_at)>1) THEN 1
        WHEN sr.freshness_policy='weekly'  AND (sr.last_verified_at IS NULL OR julianday('now')-julianday(sr.last_verified_at)>7) THEN 1
        WHEN sr.freshness_policy='monthly' AND (sr.last_verified_at IS NULL OR julianday('now')-julianday(sr.last_verified_at)>30) THEN 1
        ELSE 0
    END AS is_stale
FROM faq_source_mappings fsm
JOIN source_registry sr ON sr.source_key=fsm.source_key
WHERE fsm.mapping_status='active';

CREATE VIEW IF NOT EXISTS v_router_eligible_faq AS
SELECT f.faq_slug, f.title, COUNT(DISTINCT fsm.source_key) AS source_count
FROM faq_items f
JOIN faq_source_mappings fsm
    ON fsm.faq_slug=f.faq_slug AND fsm.mapping_status='active'
    AND fsm.review_status='reviewed' AND fsm.stale_flag=0
WHERE f.router_callable=1 AND f.review_status='approved'
    AND f.content IS NOT NULL AND f.content!=''
GROUP BY f.faq_slug;

CREATE VIEW IF NOT EXISTS v_low_confidence_violations AS
SELECT rd.decision_id, rd.query_text, rd.confidence_band, rd.answer_mode,
    rd.should_escalate, rd.retrieval_count, rd.source_count,
    rd.source_conflict, rd.source_stale, rd.risk_level, rd.query_type
FROM router_decisions rd
WHERE rd.query_type != 'out_of_scope' AND (
    (rd.confidence_band='low' AND rd.answer_mode='direct' AND rd.should_escalate=0)
   OR (rd.retrieval_count IS NOT NULL AND rd.retrieval_count<2 AND rd.answer_mode='direct' AND rd.should_escalate=0)
   OR (rd.source_count IS NOT NULL AND rd.source_count<2 AND rd.answer_mode='direct' AND rd.should_escalate=0)
   OR (rd.source_conflict=1 AND rd.should_escalate=0)
   OR (rd.source_stale=1 AND rd.answer_mode='direct')
   OR (rd.risk_level='high' AND rd.query_type='case_specific' AND rd.should_escalate=0)
);

CREATE VIEW IF NOT EXISTS v_escalation_state_violations AS
SELECT hq.escalation_id, hq.queue_status, hq.resolution_type, hq.resolved_at, hq.closed_at,
    CASE
        WHEN hq.queue_status='closed' AND hq.resolution_type IS NULL THEN 'CLOSED_NO_RESOLUTION'
        WHEN hq.queue_status='resolved' AND hq.resolved_at IS NULL THEN 'RESOLVED_NO_TIMESTAMP'
        WHEN hq.queue_status='closed' AND hq.closed_at IS NULL THEN 'CLOSED_NO_TIMESTAMP'
        ELSE 'OK'
    END AS violation
FROM human_escalation_queue hq
WHERE (hq.queue_status='closed' AND hq.resolution_type IS NULL)
   OR (hq.queue_status='resolved' AND hq.resolved_at IS NULL)
   OR (hq.queue_status='closed' AND hq.closed_at IS NULL);

CREATE VIEW IF NOT EXISTS v_orphan_events AS
SELECT he.event_id, he.escalation_id, he.event_type
FROM human_escalation_events he
LEFT JOIN human_escalation_queue hq ON hq.escalation_id=he.escalation_id
WHERE hq.id IS NULL;

CREATE VIEW IF NOT EXISTS v_writeback_traceability AS
SELECT hq.escalation_id, hq.queue_status, hq.resolution_type,
    wc.writeback_id, wc.target_type, wc.target_key, wc.status AS wb_status
FROM human_escalation_queue hq
LEFT JOIN writeback_candidates wc ON wc.escalation_id=hq.escalation_id
WHERE hq.queue_status IN ('resolved','writeback_pending','closed');

CREATE VIEW IF NOT EXISTS v_regression_coverage AS
SELECT source_origin, COUNT(*) AS total, SUM(is_active) AS active
FROM regression_cases GROUP BY source_origin;

CREATE VIEW IF NOT EXISTS v_rule_integrity AS
SELECT rd.decision_id,
    CASE
        WHEN rd.selected_rule_keys IS NOT NULL AND rd.selected_rule_versions IS NULL THEN 'MISSING_VERSIONS'
        WHEN rd.selected_rule_keys IS NOT NULL
             AND json_array_length(rd.selected_rule_keys)!=json_array_length(rd.selected_rule_versions)
            THEN 'LENGTH_MISMATCH'
        ELSE 'OK'
    END AS status
FROM router_decisions rd
WHERE rd.selected_rule_keys IS NOT NULL;

-- View: consultation records not yet ingested
CREATE VIEW IF NOT EXISTS v_consultation_pending_ingestion AS
SELECT cr.record_id, cr.query_text, cr.resolution_type, cr.tags,
    cr.ingested_to_faq, cr.ingested_to_regression
FROM consultation_records cr
WHERE cr.ingested_to_faq = 0 OR cr.ingested_to_regression = 0;
