/**
 * JTG v9 — Question Quality + Feedback Analyzer + FAQ Sync tests.
 * Custom runner pattern (no vitest).
 */

export {}

let passed = 0
let failed = 0

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  \u2705 ${label}`)
    passed++
  } else {
    console.log(`  \u274c FAIL: ${label}`)
    failed++
  }
}

async function main() {
  // ================================================================
  // A. Question Quality Scorer
  // ================================================================
  console.log('\n\u2550\u2550\u2550 A. Question Quality Scorer \u2550\u2550\u2550')

  const {
    scoreQuestionQuality,
    suggestRewrite,
    computeQualityStats,
  } = await import('../../src/lib/ai/question-quality')

  // A-01: Bare question scores low
  const bare = scoreQuestionQuality('签证')
  assert(bare.score <= 0.2, 'A-01: bare single-word scores <= 0.2')
  assert(bare.elementsPresent <= 1, 'A-02: bare has <= 1 element')
  assert(bare.lang === 'zh', 'A-03: detected zh')

  // A-04: Rich question scores high
  const rich = scoreQuestionQuality(
    '我是留学签证，想在30天内转就劳签证，请用步骤形式说明需要的材料和流程，最重要的是时间限制',
  )
  assert(rich.score >= 0.6, 'A-04: rich question scores >= 0.6')
  assert(rich.elementsPresent >= 3, 'A-05: rich has >= 3 elements')
  assert(
    rich.elements.find((e) => e.element === 'goal')!.present,
    'A-06: goal detected (想...转就劳签证)',
  )
  assert(
    rich.elements.find((e) => e.element === 'context')!.present,
    'A-07: context detected (我是留学签证)',
  )
  assert(
    rich.elements.find((e) => e.element === 'constraints')!.present,
    'A-08: constraints detected (30天内)',
  )
  assert(
    rich.elements.find((e) => e.element === 'format')!.present,
    'A-09: format detected (步骤形式)',
  )

  // A-10: Japanese detection
  const ja = scoreQuestionQuality('永住権の申請方法をステップで教えてください')
  assert(ja.lang === 'ja', 'A-10: detected ja')
  assert(ja.elements.find((e) => e.element === 'goal')!.present, 'A-11: ja goal detected')
  assert(ja.elements.find((e) => e.element === 'format')!.present, 'A-12: ja format detected')

  // A-13: English detection
  const en = scoreQuestionQuality(
    'I am on a student visa. How can I change to a work visa? Please list the steps.',
  )
  assert(en.lang === 'en', 'A-13: detected en')
  assert(en.score >= 0.4, 'A-14: en with context+goal+format >= 0.4')

  // A-15: Bad question detection — not fact based
  const subjective = scoreQuestionQuality('我漂亮吗')
  assert(subjective.badType === 'not_fact_based', 'A-15: not_fact_based detected')
  assert(subjective.suggestion !== null, 'A-16: suggestion provided for bad question')

  // A-17: Bad question detection — unknowable
  const unknowable = scoreQuestionQuality('明天股市涨吗')
  assert(unknowable.badType === 'unknowable', 'A-17: unknowable detected')

  // A-18: Normal question — no bad type
  assert(bare.badType === null, 'A-18: normal question has no badType')

  // A-19: Suggestion generated for low-quality
  assert(bare.suggestion !== null, 'A-19: suggestion for low-quality query')

  // A-20: No suggestion for high-quality
  const perfect = scoreQuestionQuality(
    '我目前在東京，留学签证，需要在2个月内转就劳签证。请用清单形式列出材料，最关键的是截止日期。',
  )
  assert(perfect.score >= 0.8, 'A-20: near-perfect score >= 0.8')

  // ================================================================
  // B. Rewrite Suggestions
  // ================================================================
  console.log('\n\u2550\u2550\u2550 B. Rewrite Suggestions \u2550\u2550\u2550')

  // B-01: Low quality gets rewrite
  const rewrite = suggestRewrite('签证')
  assert(rewrite !== null, 'B-01: low-quality gets rewrite suggestion')
  assert(rewrite!.elementsAdded.length >= 3, 'B-02: adds >= 3 missing elements')
  assert(rewrite!.qualityAfter > rewrite!.qualityBefore, 'B-03: quality improves')

  // B-04: High quality gets null (no rewrite needed)
  const noRewrite = suggestRewrite(
    '我是留学签证，想在30天内转就劳签证，请用步骤形式说明',
  )
  assert(noRewrite === null, 'B-04: high-quality returns null (no rewrite needed)')

  // B-05: Bad question gets null (can't fix)
  const badRewrite = suggestRewrite('我漂亮吗')
  assert(badRewrite === null, 'B-05: bad question returns null')

  // B-06: Japanese rewrite
  const jaRewrite = suggestRewrite('ゴミ')
  assert(jaRewrite !== null, 'B-06: ja low-quality gets rewrite')
  assert(jaRewrite!.rewritten.includes('補足'), 'B-07: ja rewrite uses Japanese hints')

  // B-08: English rewrite
  const enRewrite = suggestRewrite('visa')
  assert(enRewrite !== null, 'B-08: en low-quality gets rewrite')
  assert(enRewrite!.rewritten.includes('Add:'), 'B-09: en rewrite uses English hints')

  // ================================================================
  // C. Quality Statistics
  // ================================================================
  console.log('\n\u2550\u2550\u2550 C. Quality Statistics \u2550\u2550\u2550')

  const scores = [
    scoreQuestionQuality('签证'),
    scoreQuestionQuality('我是留学生想转就劳签证，请用步骤说明'),
    scoreQuestionQuality('我漂亮吗'),
    scoreQuestionQuality('How do I sort garbage?'),
    scoreQuestionQuality('ゴミの分別方法をステップで教えて'),
  ]

  const stats = computeQualityStats(scores)
  assert(stats.totalQueries === 5, 'C-01: totalQueries = 5')
  assert(stats.meanScore >= 0 && stats.meanScore <= 1, 'C-02: meanScore in [0,1]')
  assert(stats.medianScore >= 0 && stats.medianScore <= 1, 'C-03: medianScore in [0,1]')
  assert(stats.badQuestionRate > 0, 'C-04: badQuestionRate > 0 (1 bad out of 5)')
  assert(stats.badTypeBreakdown.not_fact_based >= 1, 'C-05: at least 1 not_fact_based')
  assert(typeof stats.elementsDistribution.goal === 'number', 'C-06: elementsDistribution has goal')
  assert(stats.lowQualityRate >= 0, 'C-07: lowQualityRate defined')
  assert(stats.highQualityRate >= 0, 'C-08: highQualityRate defined')

  // C-09: Empty array
  const emptyStats = computeQualityStats([])
  assert(emptyStats.totalQueries === 0, 'C-09: empty stats totalQueries = 0')
  assert(emptyStats.meanScore === 0, 'C-10: empty stats meanScore = 0')

  // ================================================================
  // D. Feedback Analyzer
  // ================================================================
  console.log('\n\u2550\u2550\u2550 D. Feedback Analyzer \u2550\u2550\u2550')

  const {
    identifyFaqGaps,
    identifyAnswerQualityIssues,
    analyzeEscalationPatterns,
    analyzeLanguageCoverage,
    analyzeFeedback,
  } = await import('../../src/lib/patent/feedback-analyzer')

  type FR = Parameters<typeof identifyFaqGaps>[0][0]

  // Build test feedback records
  const feedbackRecords: FR[] = [
    { id: 'f1', queryText: '垃圾怎么扔', systemAnswer: 'answer', answerMode: 'normal', isSatisfied: true, humanReply: null, language: 'zh', faqKey: 'garbage' },
    { id: 'f2', queryText: '水电费怎么交', systemAnswer: 'answer', answerMode: 'normal', isSatisfied: false, humanReply: '没有具体的缴费方式', language: 'zh', faqKey: null, shouldCreateFaq: true },
    { id: 'f3', queryText: '电费缴费方式', systemAnswer: 'answer', answerMode: 'normal', isSatisfied: false, humanReply: '需要便利店缴费方法', language: 'zh', faqKey: null },
    { id: 'f4', queryText: 'How to pay electricity bill', systemAnswer: 'answer', answerMode: 'normal', isSatisfied: false, humanReply: 'Need convenience store steps', language: 'en', faqKey: null },
    { id: 'f5', queryText: '押金不退', systemAnswer: 'answer', answerMode: 'normal', isSatisfied: false, humanReply: '答案太简单', language: 'zh', faqKey: 'deposit' },
    { id: 'f6', queryText: 'deposit refund', systemAnswer: 'answer', answerMode: 'normal', isSatisfied: false, humanReply: 'Too brief', language: 'en', faqKey: 'deposit' },
    { id: 'f7', queryText: '签证问题', systemAnswer: 'answer', answerMode: 'handoff', isSatisfied: true, humanReply: null, language: 'zh', faqKey: 'visa', category: 'visa' },
    { id: 'f8', queryText: 'visa renewal', systemAnswer: 'answer', answerMode: 'handoff', isSatisfied: false, humanReply: 'Did not get contact info', language: 'en', faqKey: 'visa', category: 'visa' },
  ]

  // D-01: FAQ gaps detection
  const gaps = identifyFaqGaps(feedbackRecords)
  assert(gaps.length > 0, 'D-01: FAQ gaps found')
  assert(gaps[0].priority === 'HIGH', 'D-02: top gap is HIGH priority (shouldCreateFaq=true)')
  assert(gaps[0].humanReplies.length > 0, 'D-03: gap has human replies')

  // D-04: Answer quality issues
  const issues = identifyAnswerQualityIssues(feedbackRecords)
  assert(issues.length > 0, 'D-04: quality issues found')
  const depositIssue = issues.find((i) => i.faqKey === 'deposit')
  assert(depositIssue !== undefined, 'D-05: deposit FAQ flagged')
  assert(depositIssue!.satisfactionRate === 0, 'D-06: deposit 0% satisfaction')
  assert(depositIssue!.complaints.length === 2, 'D-07: deposit has 2 complaints')

  // D-08: Escalation patterns
  const escalation = analyzeEscalationPatterns(feedbackRecords)
  assert(escalation.length > 0, 'D-08: escalation patterns found')
  const handoffPattern = escalation.find((e) => e.answerMode === 'handoff')
  assert(handoffPattern !== undefined, 'D-09: handoff pattern found')
  assert(handoffPattern!.count === 2, 'D-10: 2 handoff records')

  // D-11: Language coverage
  const coverage = analyzeLanguageCoverage(feedbackRecords)
  assert(coverage.length === 2, 'D-11: 2 languages in coverage')
  const zhCoverage = coverage.find((c) => c.language === 'zh')!
  const enCoverage = coverage.find((c) => c.language === 'en')!
  assert(zhCoverage.totalQueries === 5, 'D-12: zh has 5 queries')
  assert(enCoverage.totalQueries === 3, 'D-13: en has 3 queries')

  // D-14: Full analysis
  const analysis = analyzeFeedback(feedbackRecords)
  assert(analysis.totalFeedback === 8, 'D-14: total feedback = 8')
  assert(analysis.overallSatisfactionRate < 1, 'D-15: overall rate < 100%')
  assert(analysis.actionItems.length > 0, 'D-16: action items generated')
  assert(analysis.faqGaps.length > 0, 'D-17: gaps in full analysis')

  // D-18: Empty feedback
  const emptyAnalysis = analyzeFeedback([])
  assert(emptyAnalysis.totalFeedback === 0, 'D-18: empty analysis totalFeedback = 0')
  assert(emptyAnalysis.actionItems.length === 1, 'D-19: empty has 1 action item')

  // ================================================================
  // E. FAQ Sync Bridge
  // ================================================================
  console.log('\n\u2550\u2550\u2550 E. FAQ Sync Bridge \u2550\u2550\u2550')

  const { convertTopic, convertAll, computeSyncDiff } = await import(
    '../../src/lib/knowledge/faq-sync'
  )

  // E-01: Convert single topic
  const garbageTopic = {
    keywords: {
      zh: ['垃圾', '扔垃圾'],
      ja: ['ゴミ', 'ごみ'],
      en: ['garbage', 'trash'],
      vi: ['rac'],
      tl: ['basura'],
    },
    answers: {
      zh: '日本垃圾严格分类...\n\n**下一步：今天向房东要垃圾日历。**',
      ja: 'ゴミの分別は...\n\n**次のステップ：今日、管理会社にゴミカレンダーをもらいましょう。**',
      en: 'Japan has strict garbage sorting...\n\n**Next step: Ask your landlord for the garbage calendar today.**',
    },
  }

  const entry = convertTopic('garbage', garbageTopic)
  assert(entry !== null, 'E-01: garbage converts to FaqEntry')
  assert(entry!.id === 'star-garbage', 'E-02: id = star-garbage')
  assert(entry!.category === 'daily_life', 'E-03: category = daily_life')
  assert(entry!.tier === 'B', 'E-04: tier = B (procedural)')
  assert(entry!.status === 'live', 'E-05: status = live')
  assert(entry!.keywords.zh.includes('垃圾'), 'E-06: zh keywords preserved')
  assert(entry!.keywords.ja.includes('ゴミ'), 'E-07: ja keywords preserved')
  // vi/tl keywords merged into en
  assert(entry!.keywords.en.includes('rac'), 'E-08: vi keywords merged into en')
  assert(entry!.keywords.en.includes('basura'), 'E-09: tl keywords merged into en')

  // E-10: Next step extracted
  assert(
    entry!.next_step_contact.en.includes('garbage calendar'),
    'E-10: next_step extracted from en answer',
  )
  assert(
    entry!.next_step_contact.zh.includes('垃圾日历'),
    'E-11: next_step extracted from zh answer',
  )

  // E-12: Standard answer has next_step stripped
  assert(
    !entry!.standard_answer.en.includes('**Next step'),
    'E-12: standard_answer stripped of next_step',
  )

  // E-13: Fraud warning → tier A, high risk
  const fraudTopic = {
    keywords: { zh: ['诈骗'], en: ['fraud'] },
    answers: { zh: '高风险！', en: 'HIGH RISK!' },
    risk_level: 'HIGH',
  }
  const fraudEntry = convertTopic('fraud_warning', fraudTopic)
  assert(fraudEntry!.tier === 'A', 'E-13: fraud → tier A')
  assert(fraudEntry!.risk_level === 'high', 'E-14: fraud → high risk')

  // E-15: Convert all — simulate full faq_v2 data
  const mockData = {
    _meta: { version: '2.1' },
    garbage: garbageTopic,
    fraud_warning: fraudTopic,
    visa: {
      keywords: { zh: ['签证'], en: ['visa'] },
      answers: { zh: '签证信息...', en: 'Visa info...' },
    },
  }
  const allEntries = convertAll(mockData)
  assert(allEntries.length === 3, 'E-15: convertAll returns 3 entries (skips _meta)')

  // E-16: Sync diff
  const existing = [{ id: 'star-garbage', keywords: { en: ['garbage'], zh: ['垃圾'], ja: ['ゴミ'] } }]
  const diff = computeSyncDiff(existing, mockData)
  assert(diff.added.length === 2, 'E-16: 2 new topics (fraud_warning, visa)')
  assert(diff.unchanged.length === 0, 'E-17: garbage updated (keyword count differs)')
  assert(diff.updated.length === 1, 'E-18: 1 updated (garbage — keyword count changed)')
  assert(diff.totalStarTopics === 3, 'E-19: 3 total star topics')

  // E-20: Empty topic returns null
  const emptyTopic = { keywords: {}, answers: {} }
  assert(convertTopic('empty', emptyTopic) === null, 'E-20: empty topic returns null')

  // ── Summary ──
  console.log(`
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
JTG v9 Quality+Feedback+Sync Tests: ${passed} passed, ${failed} failed (${passed + failed} total)
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
