-- ============================================================
-- Foreigner Housing OS · V2.0 — Master-Plan-Aligned Seed Data
-- Domain: Japanese housing for foreigners
-- All seeds are idempotent (ON CONFLICT)
-- ============================================================

-- ─── SOURCES ────────────────────────────────────────────────

INSERT INTO source_registry (source_key, source_type, source_name, source_url, description,
    publisher, language, region, source_date, freshness_policy, last_verified_at,
    review_status, staleness_status, trust_level, notes)
VALUES
    ('mlit-housing-guide', 'document', 'MLIT Housing Guide for Foreigners',
     'https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk3_000017.html',
     'Ministry of Land official guide for foreign residents renting in Japan',
     'Ministry of Land, Infrastructure, Transport and Tourism', 'ja', 'japan_nationwide',
     '2024-04-01', 'monthly', datetime('now'), 'reviewed', 'current', 'primary',
     'Official government guideline. Available in EN/ZH/KO/VN/PT.'),

    ('tokyo-denryoku', 'external_system', 'Tokyo Electric Power (TEPCO)',
     'https://www.tepco.co.jp/en/index-e.html',
     'Official electricity provider for Kanto region',
     'TEPCO', 'ja', 'kanto', '2024-01-01', 'weekly', datetime('now'),
     'reviewed', 'current', 'primary', 'English signup available online.'),

    ('tokyo-gas', 'external_system', 'Tokyo Gas',
     'https://www.tokyo-gas.co.jp/en/',
     'Official gas provider for Tokyo metro area',
     'Tokyo Gas Co.', 'ja', 'tokyo_metro', '2024-01-01', 'weekly', datetime('now'),
     'reviewed', 'current', 'primary', 'Gas requires in-person activation visit.'),

    ('internal-faq-v1', 'internal_policy', 'Internal Agent FAQ v1',
     NULL, 'FAQ compiled from real agent consultations',
     'StartOpenAI Operations', 'en', 'japan_nationwide', '2025-12-01',
     'manual', datetime('now'), 'reviewed', 'current', 'secondary',
     'Based on 200+ real consultation cases.'),

    ('hoshou-kaisha-guide', 'document', 'Guarantor Company Guide',
     NULL, 'Internal guide on guarantor company requirements and process',
     'StartOpenAI Operations', 'ja', 'japan_nationwide', '2025-10-01',
     'monthly', datetime('now'), 'reviewed', 'current', 'secondary',
     'Covers major hoshou kaisha: Casa, Global Trust, JID, etc.'),

    ('kuyakusho-guide', 'document', 'Ward Office Registration Guide',
     NULL, 'Procedures for resident registration at ward offices',
     'Tokyo Metropolitan Government', 'ja', 'tokyo_metro', '2024-06-01',
     'monthly', datetime('now'), 'reviewed', 'current', 'primary',
     'Ward office procedures are consistent across Tokyo 23 wards.'),

    ('immigration-bureau', 'document', 'Immigration Services Agency',
     'https://www.moj.go.jp/isa/', 'Visa and residence status information',
     'Ministry of Justice', 'ja', 'japan_nationwide', '2024-04-01',
     'monthly', datetime('now'), 'reviewed', 'current', 'primary',
     'Official visa status and residence card information.'),

    ('zentaku-rengokai', 'document', 'Zenkoku Takuchi Tatamono Torihiki Gyou Kyoukai',
     'https://www.zentaku.or.jp/', 'National real estate agent industry association guidelines',
     'Zentaku Rengokai', 'ja', 'japan_nationwide', '2024-01-01',
     'monthly', datetime('now'), 'reviewed', 'current', 'primary',
     'Industry standards for agency fees, contracts, and practices.'),

    ('suumo-market-data', 'external_system', 'SUUMO Market Reports',
     'https://suumo.jp/', 'Rental market averages and trends',
     'Recruit Co., Ltd.', 'ja', 'japan_nationwide', '2025-06-01',
     'monthly', datetime('now'), 'reviewed', 'current', 'external',
     'Market data only. Not a primary source for rules or advice.')
ON CONFLICT(source_key) DO UPDATE SET
    source_name=excluded.source_name, description=excluded.description,
    publisher=excluded.publisher, language=excluded.language, region=excluded.region,
    source_date=excluded.source_date, review_status=excluded.review_status,
    staleness_status=excluded.staleness_status, trust_level=excluded.trust_level,
    notes=excluded.notes, updated_at=datetime('now');


-- ─── FAQ ITEMS (P0 full coverage) ──────────────────────────

INSERT INTO faq_items (faq_slug, title, question, short_answer, content, category,
    language, risk_level, applicability_boundary, dynamic_dependency, requires_human,
    review_status, router_callable, regression_coverable)
VALUES
    -- P0.1: 租房难点
    ('why-renting-is-hard', 'Why Renting Is Hard for Foreigners in Japan',
     'Why is it difficult for foreigners to rent in Japan?',
     'Language barriers, guarantor requirements, discrimination, and unfamiliar contract customs make renting challenging for non-Japanese residents.',
     'Common barriers: (1) Language — most listings and contracts are in Japanese. (2) Guarantor requirement — landlords require a Japanese guarantor or guarantor company. (3) Discrimination — some landlords refuse foreign tenants (legal but common). (4) Unfamiliar fees — shikikin, reikin, agency fees are unique to Japan. (5) Income proof — employment certificate required, difficult for new arrivals. (6) No credit history — Japanese credit scoring does not recognize foreign credit. Best approach: work with a foreigner-friendly agency and prepare all documents in advance.',
     'overview', 'en', 'low',
     '{"scope":"rental","applies_to":"all_foreigners"}', NULL, 0,
     'approved', 1, 1),

    -- P0.2: 初期费用
    ('initial-cost-breakdown', 'Initial Costs When Renting in Japan',
     'How much does it cost upfront to rent an apartment in Japan?',
     'Expect 4-6 months of rent as upfront costs including deposit, key money, agency fee, guarantor fee, insurance, and first month rent.',
     'When renting in Japan, expect these upfront costs: Shikikin (deposit, typically 1-2 months rent), Reikin (key money/gift, 0-2 months), first month rent, guarantor company fee (0.5-1 month), fire insurance (15,000-20,000 JPY/year), agency fee (0.5-1 month + tax), lock change fee (10,000-20,000 JPY). Total: typically 4-6 months of rent upfront.',
     'cost', 'en', 'medium',
     '{"scope":"rental","region":"japan_nationwide","excludes":["purchase","commercial"]}', NULL, 0,
     'approved', 1, 1),

    -- P0.3: 保证会社
    ('hoshou-kaisha', 'Guarantor Companies (Hoshou Kaisha)',
     'What is a guarantor company and do I need one?',
     'Most landlords require a guarantor. Foreigners without a Japanese guarantor use a guarantor company (hoshou kaisha), costing 0.5-1 month rent.',
     'Most landlords require a Japanese guarantor. Foreigners without a Japanese guarantor can use a guarantor company (hoshou kaisha). Fee: typically 0.5 to 1 month rent. Some require credit card payment. Requirements vary: residence card, income proof, employment certificate. Some companies specialize in foreign residents. Major companies: Casa, Global Trust Networks, JID. Approval takes 1-3 business days.',
     'process', 'en', 'low',
     '{"scope":"rental","applies_to":"foreigners_without_guarantor"}', NULL, 0,
     'approved', 1, 1),

    -- P0.4: 不会日语怎么办
    ('no-japanese', 'Renting Without Japanese Language Ability',
     'Can I rent an apartment if I don''t speak Japanese?',
     'Yes, through foreigner-friendly agencies, bilingual agents, or with a Japanese-speaking friend. Some processes require Japanese documents.',
     'Options for non-Japanese speakers: (1) Use foreigner-friendly real estate agencies (e.g., agencies in Roppongi, Shinjuku with English-speaking staff). (2) Bring a Japanese-speaking friend to viewings and contract signing. (3) Use translation services for contract review. (4) Some agencies provide English contracts alongside Japanese originals. Key challenges: most landlord communications are in Japanese, utility setup may require Japanese phone calls, ward office registration has limited English support. Recommendation: secure a bilingual contact before starting your search.',
     'overview', 'en', 'low',
     '{"scope":"rental","applies_to":"non_japanese_speakers"}', NULL, 0,
     'approved', 1, 1),

    -- P0.5: 签约流程
    ('contract-process', 'Rental Contract Signing Process',
     'What happens when I sign a rental contract in Japan?',
     'Contract signing involves document preparation, important matter explanation (juuyou jiko setsumei), contract signing, and payment of initial costs.',
     'Rental contract process: (1) Submit application with required documents. (2) Guarantor company screening (1-3 days). (3) Landlord approval (1-7 days). (4) Important matter explanation (juuyou jiko setsumei) — legally required explanation of property details, by a licensed agent. (5) Contract signing — review all terms, both Japanese and translated versions. (6) Payment of initial costs (usually by bank transfer before move-in). (7) Key handover on move-in date. Important: you have a cooling-off period in some cases. Always get a translated summary of key terms.',
     'process', 'en', 'medium',
     '{"scope":"rental","timing":"pre_contract"}', NULL, 0,
     'approved', 1, 1),

    -- P0.6: 入住准备
    ('move-in-preparation', 'Move-in Preparation Checklist',
     'What do I need to do when moving into a new apartment in Japan?',
     'Register at ward office within 14 days, set up utilities, get renter insurance, update your address on residence card.',
     'Move-in essentials: (1) Ward office registration (jumintoroku) within 14 days — bring residence card, passport, rental contract. (2) Electricity — contact provider or apply online. (3) Gas — requires in-person activation (someone must be home). (4) Water — contact local water bureau. (5) Internet — apply 2-4 weeks in advance (installation takes time). (6) Update address on residence card at ward office. (7) Notify employer and bank of address change. (8) Check property condition and photograph everything on day one.',
     'setup', 'en', 'low',
     '{"scope":"post_move_in","mandatory":true}', NULL, 0,
     'approved', 1, 1),

    -- P0.7: 原状回復 / 解约
    ('genshijou-kaifuku', 'Move-out Restoration (Genshijou Kaifuku)',
     'What happens to my deposit when I move out?',
     'Normal wear and tear is the landlord''s cost per MLIT guidelines. Damage beyond normal use is deducted from your deposit.',
     'When moving out, tenants must return the property to its original condition. Normal wear and tear (keinen rekka) is the landlord''s responsibility per MLIT guidelines. Tenant is responsible for damage beyond normal use. Disputes are common — document condition at move-in with photos. Deposit (shikikin) deductions must be itemized. If you disagree with deductions, you can: (1) request itemized list, (2) refer to MLIT guidelines, (3) consult free legal advice at ward office, (4) use small claims court as last resort.',
     'process', 'en', 'high',
     '{"scope":"rental","timing":"move_out"}', NULL, 0,
     'approved', 1, 1),

    -- P0.8: 看房前置
    ('viewing-appointment', 'Scheduling a Property Viewing',
     'How do I schedule a property viewing?',
     'Provide your preferred area, budget, and move-in date. An agent will search listings and arrange viewings. Bring residence card and income proof.',
     'To schedule a property viewing: provide your preferred area, budget, move-in date, and number of occupants. Our agents will search available listings and arrange viewings. Bring: residence card, proof of income. Viewings are free. Multiple properties can be viewed in one day. Tips: weekdays have more availability, bring a measuring tape, check the neighborhood at different times of day.',
     'service', 'en', 'low',
     '{"scope":"rental_and_purchase","triggers_human":true}', NULL, 1,
     'approved', 1, 1),

    -- P0.9: 外国人常见误区与风险提示
    ('common-mistakes', 'Common Mistakes Foreigners Make When Renting',
     'What are common mistakes foreigners make when renting in Japan?',
     'Not understanding contract terms, underestimating initial costs, not documenting move-in condition, and not knowing their rights.',
     'Common mistakes: (1) Not reading the contract carefully (always get a translation of key terms). (2) Underestimating initial costs — budget 5x monthly rent. (3) Not photographing the apartment at move-in — this protects your deposit at move-out. (4) Assuming Western rental norms apply — Japan has unique customs like key money, guarantor requirement. (5) Not updating address at ward office within 14 days (legally required). (6) Signing without understanding the renewal terms. (7) Not knowing your rights regarding deposit deductions (MLIT guidelines protect you). (8) Breaking lease without checking penalty terms.',
     'overview', 'en', 'medium',
     '{"scope":"rental","applies_to":"all_foreigners"}', NULL, 0,
     'approved', 1, 1),

    -- Additional coverage: visa impact
    ('visa-impact', 'How Visa Status Affects Renting',
     'Does my visa status affect my ability to rent in Japan?',
     'Yes. Visa type and remaining duration affect landlord and guarantor company decisions. Stable visas (work, spouse) are preferred.',
     'Visa impact on renting: (1) Work visa — generally accepted, employment certificate required. (2) Student visa — accepted with co-signer or guarantor company, may need enrollment certificate. (3) Dependent visa — accepted, may need spouse''s employment proof. (4) Designated activities — case by case, some landlords hesitant. (5) Temporary visitor — cannot sign standard lease. (6) PR/Long-term resident — best position, treated similar to Japanese nationals. Key: remaining visa duration matters. Less than 6 months remaining may cause rejection. Renewal receipt (shinsei-chuu stamp) helps.',
     'overview', 'en', 'medium',
     '{"scope":"rental","applies_to":"all_foreigners"}',
     '{"depends_on":"visa_status","refresh":"per_inquiry"}', 0,
     'approved', 1, 1),

    -- Additional: utilities
    ('utilities-setup', 'Setting Up Utilities (Water/Gas/Electric/Internet)',
     'How do I set up utilities in my new apartment?',
     'Contact each provider separately. Electricity can be done online, gas requires in-person visit, water through local bureau, internet takes 2-4 weeks.',
     'After moving in: (1) Electricity — contact TEPCO or regional provider, can apply online in English. (2) Gas — contact Tokyo Gas or regional provider, requires in-person activation appointment. (3) Water — contact local ward water bureau. (4) Internet — options include NTT Flets, SoftBank Hikari, au Hikari; takes 2-4 weeks for installation. Keep move-in date ready when calling.',
     'setup', 'en', 'low',
     '{"scope":"post_move_in","region":"tokyo_metro","excludes":["commercial_property"]}', NULL, 0,
     'approved', 1, 1),

    -- Additional: fire insurance
    ('fire-insurance', 'Fire Insurance (Kasai Hoken)',
     'Do I need fire insurance when renting in Japan?',
     'Yes, fire insurance is mandatory for all rental properties. Cost: 15,000-20,000 JPY/year.',
     'Fire insurance is mandatory for all rental properties in Japan. Typically arranged through the real estate agency at contract signing. Cost: 15,000-20,000 JPY per year for a standard apartment. Covers fire, water damage, and personal liability. Must be renewed annually or bi-annually.',
     'cost', 'en', 'low',
     '{"scope":"rental","mandatory":true}', NULL, 0,
     'approved', 1, 1),

    -- Additional: ward registration
    ('resident-registration', 'Resident Registration at Ward Office',
     'How do I register my address at the ward office?',
     'Visit your local ward office within 14 days of moving. Bring residence card, passport, and rental contract.',
     'Within 14 days of moving to a new address, you must register at your local ward office (kuyakusho). Bring: residence card (zairyu card), passport, rental contract. You will receive a certificate of residence (juminhyo) needed for bank accounts, phone contracts, etc. If moving between wards, you must also de-register at the old ward office.',
     'process', 'en', 'low',
     '{"scope":"all_residents","mandatory":true,"deadline":"14_days"}', NULL, 0,
     'approved', 1, 1),

    -- Additional: contract renewal
    ('contract-renewal', 'Lease Renewal Process',
     'What happens when my lease is up for renewal?',
     'Standard leases are 2 years. Renewal involves a fee (0.5-1 month rent), updated insurance, and updated guarantor contract.',
     'Standard Japanese leases are 2 years. At renewal: renewal fee (koshinryo) of 0.5-1 month rent, updated fire insurance, updated guarantor company contract if applicable. Landlord must notify at least 6 months before if they do not wish to renew. Tenant can terminate with 1-2 months notice per contract.',
     'process', 'en', 'low',
     '{"scope":"rental","timing":"renewal_period"}', NULL, 0,
     'approved', 1, 1),

    -- Additional: family/children
    ('family-renting', 'Renting with Family and Children',
     'What should I know about renting in Japan with children?',
     'Larger units (2LDK+) are common in suburbs. School district matters. Some buildings restrict families. Need to register children at ward office.',
     'Renting with family: (1) 2LDK or 3LDK apartments are standard for families. (2) Tokyo suburbs and satellite cities (Yokohama, Saitama, Chiba) offer better value. (3) School district (gakku) matters — public school enrollment depends on registered address. (4) Some mansion management associations have rules about noise/children. (5) Register children at ward office for health insurance and school enrollment. (6) International schools are an option but tuition is separate from housing. (7) Check proximity to parks, clinics, and supermarkets.',
     'overview', 'en', 'low',
     '{"scope":"rental","applies_to":"families"}', NULL, 0,
     'approved', 1, 1),

    -- Additional: what documents needed
    ('required-documents', 'Documents Needed for Rental Application',
     'What documents do I need to rent an apartment in Japan?',
     'Residence card, passport, income proof, employment certificate, and possibly a guarantor company application.',
     'Standard documents required: (1) Residence card (zairyu card) — front and back copy. (2) Passport — ID page copy. (3) Certificate of employment (zaiseki shoumei-sho) — from your employer. (4) Income proof — recent pay slips (3 months) or tax certificate (gensen choushu-hyou). (5) Guarantor company application form. (6) Seal (inkan) or signature — depends on agency. Self-employed: add tax certificate (kakutei shinkoku) and business registration. Students: add enrollment certificate and scholarship/sponsor proof.',
     'checklist', 'en', 'low',
     '{"scope":"rental"}', NULL, 0,
     'approved', 1, 1)
ON CONFLICT(faq_slug) DO UPDATE SET
    title=excluded.title, question=excluded.question, short_answer=excluded.short_answer,
    content=excluded.content, category=excluded.category, language=excluded.language,
    risk_level=excluded.risk_level, applicability_boundary=excluded.applicability_boundary,
    dynamic_dependency=excluded.dynamic_dependency, requires_human=excluded.requires_human,
    review_status=excluded.review_status, router_callable=excluded.router_callable,
    regression_coverable=excluded.regression_coverable, updated_at=datetime('now');


-- ─── FAQ SOURCE MAPPINGS ────────────────────────────────────

INSERT INTO faq_source_mappings (faq_slug, source_key, mapping_status, review_status,
                                  applicability_boundary, last_reviewed_at)
VALUES
    ('why-renting-is-hard', 'mlit-housing-guide', 'active', 'reviewed', '{"verified_for":"overview"}', datetime('now')),
    ('why-renting-is-hard', 'internal-faq-v1', 'active', 'reviewed', '{"verified_for":"agent_experience"}', datetime('now')),
    ('initial-cost-breakdown', 'mlit-housing-guide', 'active', 'reviewed', '{"verified_for":"standard_rental"}', datetime('now')),
    ('initial-cost-breakdown', 'internal-faq-v1', 'active', 'reviewed', '{"verified_for":"agent_experience"}', datetime('now')),
    ('initial-cost-breakdown', 'zentaku-rengokai', 'active', 'reviewed', '{"verified_for":"industry_standard"}', datetime('now')),
    ('hoshou-kaisha', 'hoshou-kaisha-guide', 'active', 'reviewed', '{"verified_for":"foreigner_applicants"}', datetime('now')),
    ('hoshou-kaisha', 'internal-faq-v1', 'active', 'reviewed', '{"verified_for":"agent_experience"}', datetime('now')),
    ('no-japanese', 'internal-faq-v1', 'active', 'reviewed', '{"verified_for":"agent_experience"}', datetime('now')),
    ('no-japanese', 'mlit-housing-guide', 'active', 'reviewed', '{"verified_for":"multilingual_info"}', datetime('now')),
    ('contract-process', 'zentaku-rengokai', 'active', 'reviewed', '{"verified_for":"contract_law"}', datetime('now')),
    ('contract-process', 'internal-faq-v1', 'active', 'reviewed', '{"verified_for":"agent_experience"}', datetime('now')),
    ('move-in-preparation', 'kuyakusho-guide', 'active', 'reviewed', '{"verified_for":"registration"}', datetime('now')),
    ('move-in-preparation', 'internal-faq-v1', 'active', 'reviewed', '{"verified_for":"agent_experience"}', datetime('now')),
    ('genshijou-kaifuku', 'mlit-housing-guide', 'active', 'reviewed', '{"verified_for":"mlit_guidelines"}', datetime('now')),
    ('genshijou-kaifuku', 'internal-faq-v1', 'active', 'reviewed', '{"verified_for":"agent_experience"}', datetime('now')),
    ('viewing-appointment', 'internal-faq-v1', 'active', 'reviewed', '{"verified_for":"internal_process"}', datetime('now')),
    ('common-mistakes', 'internal-faq-v1', 'active', 'reviewed', '{"verified_for":"agent_experience"}', datetime('now')),
    ('common-mistakes', 'mlit-housing-guide', 'active', 'reviewed', '{"verified_for":"guidelines"}', datetime('now')),
    ('visa-impact', 'immigration-bureau', 'active', 'reviewed', '{"verified_for":"visa_rules"}', datetime('now')),
    ('visa-impact', 'internal-faq-v1', 'active', 'reviewed', '{"verified_for":"agent_experience"}', datetime('now')),
    ('utilities-setup', 'tokyo-denryoku', 'active', 'reviewed', '{"verified_for":"kanto_region"}', datetime('now')),
    ('utilities-setup', 'tokyo-gas', 'active', 'reviewed', '{"verified_for":"tokyo_metro"}', datetime('now')),
    ('fire-insurance', 'mlit-housing-guide', 'active', 'reviewed', '{"verified_for":"standard_rental"}', datetime('now')),
    ('fire-insurance', 'internal-faq-v1', 'active', 'reviewed', '{"verified_for":"agent_experience"}', datetime('now')),
    ('resident-registration', 'kuyakusho-guide', 'active', 'reviewed', '{"verified_for":"all_wards"}', datetime('now')),
    ('contract-renewal', 'mlit-housing-guide', 'active', 'reviewed', '{"verified_for":"standard_2yr_lease"}', datetime('now')),
    ('contract-renewal', 'internal-faq-v1', 'active', 'reviewed', '{"verified_for":"agent_experience"}', datetime('now')),
    ('family-renting', 'internal-faq-v1', 'active', 'reviewed', '{"verified_for":"agent_experience"}', datetime('now')),
    ('family-renting', 'kuyakusho-guide', 'active', 'reviewed', '{"verified_for":"school_registration"}', datetime('now')),
    ('required-documents', 'internal-faq-v1', 'active', 'reviewed', '{"verified_for":"agent_experience"}', datetime('now')),
    ('required-documents', 'zentaku-rengokai', 'active', 'reviewed', '{"verified_for":"industry_standard"}', datetime('now'))
ON CONFLICT(faq_slug, source_key) DO UPDATE SET
    mapping_status=excluded.mapping_status, review_status=excluded.review_status,
    last_reviewed_at=excluded.last_reviewed_at, updated_at=datetime('now');


-- ─── RULES CATALOG ──────────────────────────────────────────

INSERT INTO rules_catalog (rule_key, rule_version, title, description, rule_body,
    rule_type, required_inputs, optional_inputs, outputs, fallback_mode,
    conflict_policy, human_override_allowed, intent_patterns, test_cases,
    risk_level, is_active, category)
VALUES
    ('initial-cost-formula', 1, 'Initial Cost Estimation Formula',
     'Calculate estimated initial rental costs based on monthly rent.',
     'total = rent * shikikin_months + rent * reikin_months + rent + rent * agency_fee_rate * 1.1 + guarantor_fee + fire_insurance + lock_change. Defaults: shikikin=1, reikin=1, agency=0.5, guarantor=rent*0.5, fire=18000, lock=15000.',
     'cost', '["monthly_rent"]', '["shikikin_months","reikin_months","agency_fee_rate"]',
     '["total_initial_cost","cost_breakdown"]', 'clarify', 'most_restrictive', 1,
     '["cost","price","fee","how much","budget","calculate","initial"]',
     '["reg-faq-initial-cost","reg-rule-cost-calc"]',
     'medium', 1, 'cost'),

    ('budget-feasibility', 1, 'Budget Feasibility Check',
     'Check if user budget can cover initial costs plus 3 months buffer.',
     'IF budget < estimated_initial_cost + monthly_rent * 3 THEN answer_mode="clarify", warn="budget may be insufficient". IF budget < estimated_initial_cost THEN answer_mode="official_only", warn="budget below minimum".',
     'cost', '["monthly_rent","budget"]', NULL,
     '["feasibility_status","warning"]', 'clarify', 'most_restrictive', 1,
     '["afford","budget","enough money"]', NULL,
     'high', 1, 'cost'),

    ('missing-input-clarification', 1, 'Missing Input Clarification',
     'When required inputs are missing, ask the user to provide them before proceeding.',
     'IF required_inputs NOT satisfied THEN answer_mode="clarify", list missing inputs explicitly.',
     'clarification', '[]', NULL, '["missing_inputs_list","clarify_prompt"]',
     'clarify', 'escalate', 1,
     '["*"]', NULL,
     'low', 1, 'clarification'),

    ('low-confidence-gate', 1, 'Low Confidence Gate',
     'Block direct answers when confidence is low.',
     'IF confidence_band="low" THEN answer_mode IN ("clarify","official_only","handoff"), never "direct".',
     'confidence', '["confidence_band"]', NULL, '["blocked_reason"]',
     'official_only', 'most_restrictive', 0,
     '["*"]', NULL,
     'medium', 1, 'safety'),

    ('high-risk-gate', 1, 'High Risk Gate',
     'Escalate all high-risk case-specific questions.',
     'IF risk_level="high" AND query_type="case_specific" THEN should_escalate=1, answer_mode="handoff".',
     'escalation', '["risk_level","query_type"]', NULL, '["escalation_trigger"]',
     'handoff', 'escalate', 0,
     '["legal","court","sue","dispute","contract clause"]',
     '["reg-rule-legal"]',
     'high', 1, 'safety'),

    ('official-only-gate', 1, 'Official Only Gate',
     'When source quality is degraded, restrict to official sources only.',
     'IF source_stale=true OR source_count<2 THEN answer_mode="official_only".',
     'output_mode', '["source_stale","source_count"]', NULL, '["restricted_mode"]',
     'official_only', 'most_restrictive', 1,
     '["*"]', NULL,
     'medium', 1, 'safety'),

    ('escalation-gate', 1, 'Escalation Gate',
     'Master gate that forces escalation when any critical condition is met.',
     'IF low_confidence AND high_risk THEN escalate. IF source_conflict THEN escalate. IF dynamic_blocked THEN escalate. IF repeated_clarification_failed THEN escalate.',
     'escalation', '["confidence_band","risk_level","source_conflict"]', NULL,
     '["escalation_trigger","priority_band"]', 'handoff', 'escalate', 0,
     '["*"]', NULL,
     'high', 1, 'safety'),

    ('viewing-escalation', 1, 'Viewing Request Forces Human Handoff',
     'Any request to schedule a viewing must be escalated to a human agent.',
     'IF intent="schedule_viewing" OR intent="see_property" THEN should_escalate=1, answer_mode="handoff", priority="high".',
     'escalation', '["intent"]', NULL, '["escalation_trigger"]',
     'handoff', 'escalate', 0,
     '["view","visit","see apartment","schedule","property viewing","see a property"]',
     '["reg-rule-viewing"]',
     'low', 1, 'escalation'),

    ('high-risk-case-block', 1, 'Block Direct Answer on High Risk Case-Specific',
     'High risk case-specific questions must not receive direct AI answers.',
     'IF risk_level="high" AND query_type="case_specific" THEN answer_mode="handoff", should_escalate=1.',
     'escalation', '["risk_level","query_type"]', NULL, '["blocked_reason"]',
     'handoff', 'escalate', 0,
     '["unfair","illegal","rights","violation"]', NULL,
     'high', 1, 'safety'),

    ('source-conflict-block', 1, 'Block Direct Answer on Source Conflict',
     'If sources conflict, do not provide a direct answer.',
     'IF source_conflict=true THEN answer_mode IN ("clarify","official_only","handoff"), should_escalate=1.',
     'confidence', '["source_conflict"]', NULL, '["blocked_reason"]',
     'handoff', 'escalate', 0, NULL, NULL,
     'high', 1, 'safety'),

    ('stale-source-block', 1, 'Block Direct Answer on Stale Source',
     'If source is stale, do not provide direct answer.',
     'IF source_stale=true THEN answer_mode!="direct", trace_tags+=["stale_source"].',
     'output_mode', '["source_stale"]', NULL, '["restricted_mode"]',
     'official_only', 'most_restrictive', 1, NULL, NULL,
     'medium', 1, 'safety'),

    ('contract-legal-escalate', 1, 'Legal Contract Questions Escalate',
     'Questions about contract disputes, legal rights, or specific clause interpretation must escalate.',
     'IF category="legal" OR intent="dispute" OR intent="contract_clause" THEN should_escalate=1, answer_mode="handoff", priority="high".',
     'escalation', '["intent","category"]', NULL, '["escalation_trigger"]',
     'handoff', 'escalate', 0,
     '["legal","sue","dispute","court","lawyer","rights","unfair","refusing"]',
     '["reg-rule-legal"]',
     'high', 1, 'escalation'),

    ('material-checklist', 1, 'Required Documents Checklist Generator',
     'Generate checklist of documents needed for rental application.',
     'base=["residence_card","passport","income_proof","employment_cert"]. IF self_employed: add ["tax_cert","business_registration"]. IF student: add ["enrollment_cert","scholarship_proof_or_sponsor"]. IF no_guarantor: add ["guarantor_company_application"].',
     'routing', '["employment_status"]', '["visa_type"]',
     '["document_checklist"]', 'clarify', 'manual', 1,
     '["document","checklist","what do i need","requirements","papers"]',
     NULL,
     'low', 1, 'checklist')
ON CONFLICT(rule_key, rule_version) DO UPDATE SET
    title=excluded.title, rule_body=excluded.rule_body, rule_type=excluded.rule_type,
    required_inputs=excluded.required_inputs, optional_inputs=excluded.optional_inputs,
    outputs=excluded.outputs, fallback_mode=excluded.fallback_mode,
    conflict_policy=excluded.conflict_policy, human_override_allowed=excluded.human_override_allowed,
    intent_patterns=excluded.intent_patterns, test_cases=excluded.test_cases,
    is_active=excluded.is_active, updated_at=datetime('now');


-- ─── SAMPLE ROUTER DECISIONS ────────────────────────────────

INSERT INTO router_decisions (decision_id, query_text, query_type, risk_level,
    confidence_band, selected_rule_keys, selected_rule_versions,
    selected_faq_slugs, missing_inputs, answer_mode, should_escalate,
    decision_reason, trace_tags, retrieval_count, source_count,
    source_conflict, source_stale)
VALUES
    ('d-001', 'How much does it cost to rent an apartment in Tokyo?', 'faq', 'low', 'high',
     NULL, NULL, '["initial-cost-breakdown"]', NULL, 'direct', 0,
     'FAQ hit: initial-cost-breakdown with 2 reviewed sources', '["faq_hit"]', 3, 2, 0, 0),

    ('d-002', 'I want to calculate initial costs for 80,000 yen rent', 'formula', 'medium', 'high',
     '["initial-cost-formula"]', '[1]', '["initial-cost-breakdown"]', NULL, 'direct', 0,
     'Rule initial-cost-formula v1 applied with known monthly_rent', '["rule_hit","formula"]', 2, 2, 0, 0),

    ('d-003', 'Can I rent without a guarantor?', 'faq', 'low', 'high',
     NULL, NULL, '["hoshou-kaisha"]', NULL, 'direct', 0,
     'FAQ hit: hoshou-kaisha with 2 sources', '["faq_hit"]', 3, 2, 0, 0),

    ('d-004', 'I want to see an apartment in Shibuya this weekend', 'case_specific', 'low', 'high',
     '["viewing-escalation"]', '[1]', '["viewing-appointment"]', NULL, 'handoff', 1,
     'Rule viewing-escalation: viewing requests must go to human', '["rule_hit","human_handoff"]', 2, 2, 0, 0),

    ('d-005', 'My landlord is keeping all my deposit unfairly', 'case_specific', 'high', 'low',
     '["contract-legal-escalate"]', '[1]', '["genshijou-kaifuku"]',
     '["specific_contract_details","damage_photos"]', 'handoff', 1,
     'High risk case_specific + legal dispute -> escalate', '["low_confidence","high_risk","legal"]', 1, 1, 0, 0),

    ('d-006', 'How do I set up electricity?', 'faq', 'low', 'high',
     NULL, NULL, '["utilities-setup"]', NULL, 'direct', 0,
     'FAQ hit: utilities-setup with 2 sources', '["faq_hit"]', 3, 2, 0, 0),

    ('d-007', 'Is 2 million yen enough to buy an apartment?', 'dynamic', 'high', 'low',
     NULL, NULL, NULL, '["property_type","target_area","income_proof"]', 'handoff', 1,
     'Purchase question with insufficient context, dynamic data unavailable',
     '["low_confidence","dynamic_blocked","missing_inputs"]', 0, 0, 0, 0),

    ('d-008', 'What documents do I need to rent?', 'checklist', 'low', 'high',
     '["material-checklist"]', '[1]', NULL, '["employment_status"]', 'clarify', 0,
     'Rule material-checklist needs employment_status to generate full list',
     '["rule_hit","missing_inputs"]', 2, 2, 0, 0),

    ('d-009', 'Write me a poem about Tokyo', 'out_of_scope', 'low', 'high',
     NULL, NULL, NULL, NULL, 'direct', 0,
     'Out of scope: not related to housing services', '["out_of_scope"]', 0, 0, 0, 0),

    ('d-010', 'Two different agents told me different renewal fees', 'faq', 'medium', 'low',
     NULL, NULL, '["contract-renewal"]', NULL, 'clarify', 1,
     'Source conflict on renewal fee amounts',
     '["source_conflict","low_confidence"]', 2, 2, 1, 0)
ON CONFLICT(decision_id) DO NOTHING;


-- ─── ESCALATION QUEUE ───────────────────────────────────────

INSERT INTO human_escalation_queue (escalation_id, decision_id, query_text, risk_level,
    confidence_band, escalation_reason, priority_band, sla_tier,
    selected_faq_slugs, selected_rule_keys, source_issue_flags, queue_status)
VALUES
    ('esc-001', 'd-004', 'I want to see an apartment in Shibuya this weekend',
     'low', 'high', 'Viewing request — rule viewing-escalation requires human handoff',
     'high', 'tier2', '["viewing-appointment"]', '["viewing-escalation"]', NULL, 'open'),

    ('esc-002', 'd-005', 'My landlord is keeping all my deposit unfairly',
     'high', 'low', 'High risk legal dispute + low confidence + missing case details',
     'critical', 'tier3', '["genshijou-kaifuku"]', '["contract-legal-escalate"]',
     '["insufficient_source"]', 'open'),

    ('esc-003', 'd-007', 'Is 2 million yen enough to buy an apartment?',
     'high', 'low', 'Dynamic data blocked — no purchase price source available',
     'normal', 'tier1', NULL, NULL, '["dynamic_blocked","no_source"]', 'open'),

    ('esc-004', 'd-010', 'Two different agents told me different renewal fees',
     'medium', 'low', 'Source conflict on renewal fee policy',
     'normal', 'tier1', '["contract-renewal"]', NULL, '["source_conflict"]', 'open')
ON CONFLICT(escalation_id) DO NOTHING;

INSERT INTO human_escalation_events (event_id, escalation_id, event_type, actor, actor_type, event_data)
VALUES
    ('evt-001', 'esc-001', 'enqueue', 'router', 'router', '{"decision_id":"d-004","auto":true}'),
    ('evt-002', 'esc-002', 'enqueue', 'router', 'router', '{"decision_id":"d-005","auto":true}'),
    ('evt-003', 'esc-003', 'enqueue', 'router', 'router', '{"decision_id":"d-007","auto":true}'),
    ('evt-004', 'esc-004', 'enqueue', 'router', 'router', '{"decision_id":"d-010","auto":true}')
ON CONFLICT(event_id) DO NOTHING;

-- Resolve esc-004 to demonstrate writeback path
UPDATE human_escalation_queue SET
    queue_status='resolved', resolution_type='faq_updated',
    resolution_note='Confirmed: standard renewal fee is 1 month rent. Updated FAQ to clarify.',
    writeback_actions='["wb-001"]',
    resolved_at=datetime('now'), updated_at=datetime('now')
WHERE escalation_id='esc-004' AND queue_status='open';

INSERT INTO human_escalation_events (event_id, escalation_id, event_type, actor, actor_type, event_data)
VALUES
    ('evt-005', 'esc-004', 'resolved', 'agent_tanaka', 'agent',
     '{"resolution":"faq_updated","note":"Renewal fee confirmed as 1 month standard"}'),
    ('evt-006', 'esc-004', 'writeback_created', 'system', 'system',
     '{"writeback_id":"wb-001","target":"faq_update","key":"contract-renewal"}')
ON CONFLICT(event_id) DO NOTHING;


-- ─── WRITEBACK CANDIDATE ────────────────────────────────────

INSERT INTO writeback_candidates (writeback_id, escalation_id, target_type, target_key,
    candidate_data, notes, status)
VALUES
    ('wb-001', 'esc-004', 'faq_update', 'contract-renewal',
     '{"field":"content","action":"append","text":"Standard renewal fee (koshinryo) is 1 month rent in most contracts. Some newer contracts waive this fee. Always check your specific contract terms.","reason":"Source conflict resolved by agent_tanaka"}',
     'Resolved by agent_tanaka after checking 3 actual contracts.',
     'pending')
ON CONFLICT(writeback_id) DO NOTHING;


-- ─── REGRESSION CASES ───────────────────────────────────────

INSERT INTO regression_cases (case_key, query_text, expected_query_type,
    expected_rule_keys, expected_faq_slugs, expected_confidence_band,
    expected_answer_mode, expected_should_escalate, risk_level,
    source_origin, created_from, source_reference)
VALUES
    ('reg-faq-initial-cost', 'How much does it cost to rent in Japan?',
     'formula', '["initial-cost-formula"]', '["initial-cost-breakdown"]', 'high', 'clarify', 0,
     'low', 'faq_seed', 'seed', 'initial-cost-breakdown'),

    ('reg-faq-guarantor', 'Do I need a guarantor to rent?',
     'faq', NULL, '["hoshou-kaisha"]', 'high', 'direct', 0,
     'low', 'faq_seed', 'seed', 'hoshou-kaisha'),

    ('reg-faq-utilities', 'How do I turn on gas and electricity?',
     'faq', NULL, '["utilities-setup"]', 'high', 'direct', 0,
     'low', 'faq_seed', 'seed', 'utilities-setup'),

    ('reg-rule-cost-calc', 'Calculate initial costs for 100,000 yen rent',
     'formula', '["initial-cost-formula"]', '["initial-cost-breakdown"]', 'high', 'clarify', 0,
     'medium', 'rule_test', 'seed', 'initial-cost-formula'),

    ('reg-rule-viewing', 'I want to visit a property tomorrow',
     'case_specific', '["viewing-escalation"]', '["viewing-appointment"]', 'high', 'handoff', 1,
     'low', 'rule_test', 'seed', 'viewing-escalation'),

    ('reg-rule-legal', 'My landlord sued me over damages',
     'case_specific', '["contract-legal-escalate"]', NULL, 'low', 'handoff', 1,
     'high', 'rule_test', 'seed', 'contract-legal-escalate'),

    ('reg-esc-renewal-fee', 'Tell me about lease renewal and contract extension',
     'faq', NULL, '["contract-renewal"]', 'high', 'direct', 0,
     'low', 'escalation_resolution', 'seed', 'esc-004'),

    ('reg-fail-source-conflict', 'I heard conflicting info about deposit rules',
     'faq', NULL, '["genshijou-kaifuku"]', 'high', 'direct', 0,
     'medium', 'source_conflict', 'seed', NULL),

    ('reg-fail-dynamic-blocked', 'What apartments are available in Meguro right now?',
     'dynamic', NULL, NULL, 'low', 'handoff', 1,
     'medium', 'dynamic_blocked', 'seed', NULL),

    ('reg-fail-out-of-scope', 'Write me a poem about programming',
     'out_of_scope', NULL, NULL, 'low', 'direct', 0,
     'low', 'manual', 'seed', NULL),

    -- Additional regression for new FAQ items
    ('reg-faq-why-hard', 'Why is it so hard for foreigners to find housing?',
     'faq', NULL, '["why-renting-is-hard"]', 'high', 'direct', 0,
     'low', 'faq_seed', 'seed', 'why-renting-is-hard'),

    ('reg-faq-visa', 'Does my visa type affect renting?',
     'faq', NULL, '["visa-impact"]', 'high', 'direct', 0,
     'medium', 'faq_seed', 'seed', 'visa-impact'),

    ('reg-faq-no-japanese', 'I cannot speak Japanese can I still rent',
     'faq', NULL, '["no-japanese"]', 'high', 'direct', 0,
     'low', 'faq_seed', 'seed', 'no-japanese'),

    ('reg-faq-family', 'We have two children and need a bigger place',
     'faq', NULL, '["family-renting"]', 'high', 'direct', 0,
     'low', 'faq_seed', 'seed', 'family-renting'),

    ('reg-faq-mistakes', 'What mistakes should I avoid when renting?',
     'faq', NULL, '["common-mistakes"]', 'high', 'direct', 0,
     'medium', 'faq_seed', 'seed', 'common-mistakes')
ON CONFLICT(case_key) DO UPDATE SET
    query_text=excluded.query_text, expected_query_type=excluded.expected_query_type,
    expected_rule_keys=excluded.expected_rule_keys, expected_faq_slugs=excluded.expected_faq_slugs,
    expected_confidence_band=excluded.expected_confidence_band,
    expected_answer_mode=excluded.expected_answer_mode,
    expected_should_escalate=excluded.expected_should_escalate,
    source_origin=excluded.source_origin, created_from=excluded.created_from,
    updated_at=datetime('now');


-- ─── 50 CONSULTATION RECORDS ────────────────────────────────
-- Real-pattern queries based on common foreigner housing inquiries

INSERT INTO consultation_records (record_id, source_channel, query_text, query_language,
    client_context, visa_status, resolution_text, resolution_type, resolved_by,
    tags, faq_slug_match, rule_key_match)
VALUES
    ('cr-001','email','How much money should I prepare before renting?','en','{"budget":"unknown"}','work','Explained 4-6x monthly rent rule. Sent cost calculator link.','answered','agent_suzuki','["cost","initial"]','initial-cost-breakdown','initial-cost-formula'),
    ('cr-002','line','保証会社の審査に落ちました。どうすればいいですか？','ja','{"guarantor":"rejected"}','work','Recommended trying Global Trust Networks. Explained alternative options.','answered','agent_tanaka','["guarantor","rejection"]','hoshou-kaisha',NULL),
    ('cr-003','web','I just arrived in Japan last week. What should I do first?','en','{"stage":"just_arrived"}','work','Provided move-in checklist: ward office, bank account, phone, utilities.','answered','agent_suzuki','["new_arrival","checklist"]','move-in-preparation',NULL),
    ('cr-004','phone','Can you help me find a 2LDK in Setagaya under 150k?','ja','{"budget":"150000","area":"setagaya"}','spouse','Searched listings and scheduled 3 viewings.','escalated','agent_yamada','["viewing","search"]','viewing-appointment','viewing-escalation'),
    ('cr-005','email','My landlord says I owe 300,000 yen for cleaning. Is this normal?','en','{"dispute":"deposit"}','work','Referred to MLIT guidelines. Amount seems excessive for normal wear.','escalated','agent_tanaka','["deposit","dispute","move_out"]','genshijou-kaifuku','contract-legal-escalate'),
    ('cr-006','web','I have a student visa. Can I still rent an apartment?','en','{"visa":"student"}','student','Yes, with guarantor company. Need enrollment certificate and financial proof.','answered','agent_suzuki','["visa","student"]','visa-impact',NULL),
    ('cr-007','line','引っ越し先でガスの開栓をしたいのですが','ja','{"stage":"moving_in"}','work','Explained gas activation requires in-person visit. Gave Tokyo Gas contact.','answered','agent_yamada','["utilities","gas"]','utilities-setup',NULL),
    ('cr-008','email','What is reikin? Why do I have to pay it?','en','{"knowledge":"basic"}','work','Explained key money concept. It is a gift to landlord, non-refundable.','answered','agent_suzuki','["cost","reikin","key_money"]','initial-cost-breakdown',NULL),
    ('cr-009','web','I don''t speak Japanese at all. How do I find an apartment?','en','{"jp_level":"none"}','work','Recommended foreigner-friendly agencies. Offered to help in English.','answered','agent_suzuki','["language","no_japanese"]','no-japanese',NULL),
    ('cr-010','phone','契約更新の時期ですが、更新料はいくらですか？','ja','{"stage":"renewal"}','pr','Standard is 1 month rent. Checked their specific contract: 1 month confirmed.','answered','agent_tanaka','["renewal","fee"]','contract-renewal',NULL),
    ('cr-011','email','My company is transferring me to Tokyo next month. Where should I look?','en','{"timeline":"1_month","area":"unknown"}','work','Asked about commute target, budget, family size. Need more info.','answered','agent_suzuki','["relocation","area_search"]',NULL,'missing-input-clarification'),
    ('cr-012','web','Is it true that some landlords won''t rent to foreigners?','en','{}','work','Unfortunately yes. Explained discrimination situation and recommended foreigner-friendly agencies.','answered','agent_suzuki','["discrimination","overview"]','why-renting-is-hard',NULL),
    ('cr-013','line','火災保険って自分で選べますか？','ja','{}','work','Agency usually arranges it but you can choose your own. Gave comparison tips.','answered','agent_yamada','["insurance","fire"]','fire-insurance',NULL),
    ('cr-014','email','We have a baby. Any special requirements for renting?','en','{"family":"baby"}','dependent','Some buildings have noise restrictions. Recommend 1F or family-friendly buildings.','answered','agent_suzuki','["family","children"]','family-renting',NULL),
    ('cr-015','web','What happens if I break my lease early?','en','{"concern":"early_termination"}','work','Typically 1-2 months penalty. Check contract for specific terms.','answered','agent_tanaka','["lease","break","penalty"]','contract-renewal',NULL),
    ('cr-016','phone','住民票が必要なんですが、どうやって取得しますか？','ja','{"need":"juminhyo"}','work','Go to ward office with residence card. Explained process.','answered','agent_yamada','["registration","juminhyo"]','resident-registration',NULL),
    ('cr-017','email','I''m self-employed. What extra documents do I need?','en','{"employment":"self_employed"}','work','Tax certificate and business registration in addition to standard docs.','answered','agent_suzuki','["documents","self_employed"]','required-documents','material-checklist'),
    ('cr-018','web','How do I find an apartment near Shinjuku station?','en','{"area":"shinjuku"}','work','Clarified budget and room size first. Then searched listings.','escalated','agent_suzuki','["search","area"]','viewing-appointment','viewing-escalation'),
    ('cr-019','line','敷金は全額返ってきますか？','ja','{"concern":"deposit_return"}','work','Depends on condition. Normal wear = landlord pays. Documented MLIT rules.','answered','agent_tanaka','["deposit","move_out"]','genshijou-kaifuku',NULL),
    ('cr-020','email','Can I rent with only 3 months left on my visa?','en','{"visa_remaining":"3_months"}','work','Difficult. Most require 6+ months. Recommend applying for renewal first.','answered','agent_suzuki','["visa","expiring"]','visa-impact',NULL),
    ('cr-021','web','What is the difference between 1K, 1DK, and 1LDK?','en','{"knowledge":"basic"}','work','Explained Japanese apartment layout naming conventions.','answered','agent_suzuki','["layout","terminology"]',NULL,NULL),
    ('cr-022','phone','インターネット回線の工事に2週間かかると言われました','ja','{"issue":"internet_delay"}','work','Normal timeframe. Recommend pocket WiFi as interim solution.','answered','agent_yamada','["internet","utilities"]','utilities-setup',NULL),
    ('cr-023','email','My guarantor company is asking for my credit card. Is this normal?','en','{"concern":"guarantor_payment"}','work','Yes, some companies require credit card for monthly guarantee fee payment.','answered','agent_suzuki','["guarantor","payment"]','hoshou-kaisha',NULL),
    ('cr-024','web','I want to know about tatami maintenance','en','{}','work','Tatami is landlord responsibility for age deterioration. Tenant pays for damage.','answered','agent_tanaka','["maintenance","tatami"]','genshijou-kaifuku',NULL),
    ('cr-025','line','外国人でも住宅ローン組めますか？','ja','{"topic":"purchase"}','pr','Possible with PR status and stable income. Recommended bank consultation.','referred','agent_yamada','["purchase","loan"]',NULL,NULL),
    ('cr-026','email','How do I get NHK to stop coming to my door?','en','{"concern":"nhk"}','work','NHK fee is legally required if you have a TV. Explained options.','answered','agent_suzuki','["nhk","fee"]',NULL,NULL),
    ('cr-027','web','Planning to move to Japan in 6 months. When should I start looking?','en','{"timeline":"6_months","stage":"before_japan"}','none','Start 2-3 months before. Explained timeline and preparation steps.','answered','agent_suzuki','["planning","timeline"]',NULL,NULL),
    ('cr-028','phone','管理費と共益費の違いは何ですか？','ja','{}','work','Functionally the same — monthly building maintenance fee.','answered','agent_yamada','["fee","management"]','initial-cost-breakdown',NULL),
    ('cr-029','email','I found a property on Suumo but the agency won''t respond to foreigners','en','{"issue":"discrimination"}','work','This happens. Recommended alternative agencies. Offered to contact on their behalf.','escalated','agent_suzuki','["discrimination","agency"]','why-renting-is-hard',NULL),
    ('cr-030','web','What should I check during a property viewing?','en','{}','work','Provided viewing checklist: water pressure, outlets, noise, sunlight, storage.','answered','agent_suzuki','["viewing","checklist"]','viewing-appointment',NULL),
    ('cr-031','line','保証人がいない場合はどうすればいいですか','ja','{}','student','Guarantor company is the standard solution. Explained process and fees.','answered','agent_tanaka','["guarantor","no_guarantor"]','hoshou-kaisha',NULL),
    ('cr-032','email','Can my company be my guarantor?','en','{"employment":"corporate"}','work','Some companies offer corporate guarantor. Check with HR first.','answered','agent_suzuki','["guarantor","corporate"]','hoshou-kaisha',NULL),
    ('cr-033','web','I am moving to Osaka. Do the same rules apply?','en','{"area":"osaka"}','work','Basic rules are nationwide. Some regional differences in customs (Osaka often has lower key money).','answered','agent_suzuki','["regional","osaka"]','initial-cost-breakdown',NULL),
    ('cr-034','phone','退去時にクリーニング代を請求されました。払う必要がありますか？','ja','{"dispute":"cleaning_fee"}','work','Check contract. If standard clause exists, usually tenant pays. If excessive, dispute with MLIT guidelines.','answered','agent_tanaka','["move_out","cleaning","dispute"]','genshijou-kaifuku',NULL),
    ('cr-035','email','How long does the rental application process take?','en','{}','work','Typically 1-2 weeks from application to key handover.','answered','agent_suzuki','["process","timeline"]','contract-process',NULL),
    ('cr-036','web','Do I need to be in Japan to sign a rental contract?','en','{"stage":"before_japan"}','work','Generally yes, you need to be present. Some agencies offer proxy signing.','answered','agent_suzuki','["contract","remote"]','contract-process',NULL),
    ('cr-037','line','友達とシェアハウスに住みたいのですが','ja','{"type":"share_house"}','student','Share houses have different rules. Explained deposit vs no-deposit options.','answered','agent_yamada','["share_house"]',NULL,NULL),
    ('cr-038','email','My apartment has mold problems. What can I do?','en','{"issue":"mold"}','work','Mold from building structure = landlord responsibility. From poor ventilation = shared responsibility.','answered','agent_tanaka','["maintenance","mold","dispute"]','genshijou-kaifuku',NULL),
    ('cr-039','web','What is juuyou jiko setsumei?','en','{"knowledge":"basic"}','work','Important matter explanation — legally required briefing before contract signing.','answered','agent_suzuki','["contract","terminology"]','contract-process',NULL),
    ('cr-040','phone','引っ越し業者のおすすめはありますか？','ja','{"stage":"moving"}','work','Recommended Sakai, Art, Nittsu. Get 3 quotes.','referred','agent_yamada','["moving","service"]',NULL,NULL),
    ('cr-041','email','I want to rent a pet-friendly apartment in Tokyo','en','{"pets":"yes","area":"tokyo"}','work','Limited but available. Searched pet-friendly listings. Extra deposit often required.','escalated','agent_suzuki','["pets","search"]','viewing-appointment','viewing-escalation'),
    ('cr-042','web','How much is average rent in Shibuya for a 1LDK?','en','{"area":"shibuya","type":"1LDK"}','work','Approximately 120,000-180,000 JPY. Varies by building age and distance from station.','answered','agent_suzuki','["rent","market","area"]',NULL,NULL),
    ('cr-043','line','重要事項説明書の英語版はもらえますか？','ja','{}','work','Not always available. Some agencies provide. Otherwise use translation service.','answered','agent_yamada','["contract","translation"]','no-japanese',NULL),
    ('cr-044','email','My visa renewal is pending. Can I still sign a new lease?','en','{"visa":"renewal_pending"}','work','Yes, with the renewal receipt stamp on residence card. Explained to agencies.','answered','agent_suzuki','["visa","renewal"]','visa-impact',NULL),
    ('cr-045','web','What is the agency fee limit in Japan?','en','{"concern":"agency_fee"}','work','Legal max is 1 month rent + tax. Many charge 0.5 months.','answered','agent_suzuki','["cost","agency_fee"]','initial-cost-breakdown',NULL),
    ('cr-046','phone','大家さんが更新を拒否しました。どうすればいいですか？','ja','{"dispute":"renewal_refusal"}','work','Landlord must have legitimate reason and give 6 months notice. Explained tenant protections.','escalated','agent_tanaka','["renewal","dispute","legal"]','contract-renewal','contract-legal-escalate'),
    ('cr-047','email','I am an international student. What financial documents do I need?','en','{"employment":"student"}','student','Enrollment certificate, scholarship letter or sponsor letter, bank statement.','answered','agent_suzuki','["documents","student"]','required-documents','material-checklist'),
    ('cr-048','web','Can I negotiate the rent price in Japan?','en','{}','work','Possible but uncommon. More success negotiating move-in costs (reikin, agency fee).','answered','agent_suzuki','["negotiation","rent"]','initial-cost-breakdown',NULL),
    ('cr-049','line','ペットを飼っていますが、退去時に追加費用がかかりますか？','ja','{"pets":"yes","concern":"move_out"}','work','Usually yes. Extra cleaning fee for pet damage. Check contract for pet deposit clause.','answered','agent_tanaka','["pets","move_out","deposit"]','genshijou-kaifuku',NULL),
    ('cr-050','email','Summary of everything I need to know about renting as a foreigner?','en','{"knowledge":"comprehensive"}','work','Sent comprehensive guide covering: search, application, contract, move-in, rights.','answered','agent_suzuki','["overview","comprehensive"]','why-renting-is-hard',NULL)
ON CONFLICT(record_id) DO UPDATE SET
    query_text=excluded.query_text, resolution_text=excluded.resolution_text,
    updated_at=datetime('now');
