/**
 * JTG V6 P1-3 — Language bridge scenario templates.
 *
 * V6 执行文件 §P1-3:
 *   "情景选择入口（4大类 × 3小类 = 12个情景模板）"
 *   "情景流程图生成器（if A说 → 回答X / if B说 → 回答Y）"
 *
 * Each scenario encodes:
 *   - Category + subcategory (total 12 scenarios)
 *   - Opening line in Japanese (the hardest part for users)
 *   - Expected responses and follow-up branches
 *   - Failure templates (couldn't understand / wrong number / etc.)
 *
 * Pure data + pure lookup functions. No I/O.
 */

// ---------------------------------------------------------------------
// Types.
// ---------------------------------------------------------------------

export type ScenarioCategory =
  | 'housing'      // 住居
  | 'municipal'    // 行政手続き
  | 'utilities'    // 生活インフラ
  | 'emergency'    // 緊急対応

export interface FlowBranch {
  /** What the other party might say (Japanese). */
  theyMightSay: string
  /** How to respond (Japanese template). */
  youRespond: string
  /** Plain explanation for the user (their locale). */
  explanation: { en: string; zh: string; ja: string }
}

export interface FailureTemplate {
  /** Trigger situation. */
  situation: string
  /** Japanese phrase to use. */
  jaPhrase: string
  /** Explanation. */
  explanation: { en: string; zh: string; ja: string }
}

export interface ScenarioTemplate {
  id: string
  category: ScenarioCategory
  subcategory: string
  /** Human-readable title. */
  title: { en: string; zh: string; ja: string }
  /** The opening line the user should say. */
  openingLine: string
  /** Phonetic reading (hiragana) for the opening line. */
  reading: string
  /** Context: when to use this scenario. */
  context: { en: string; zh: string; ja: string }
  /** Possible conversation branches. */
  branches: FlowBranch[]
  /** Failure/recovery templates. */
  failures: FailureTemplate[]
  /** Risk level of this scenario. */
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
}

// ---------------------------------------------------------------------
// Scenario data (4 categories × 3 subcategories = 12).
// ---------------------------------------------------------------------

export const SCENARIOS: ScenarioTemplate[] = [
  // ================================================================
  // Category 1: HOUSING (住居) — 3 scenarios
  // ================================================================
  {
    id: 'HOUSING-01',
    category: 'housing',
    subcategory: 'repair_request',
    title: {
      en: 'Request a repair to your landlord',
      zh: '向房东请求修理',
      ja: '大家さんに修理を依頼する',
    },
    openingLine: 'すみません、○○が壊れてしまったので、修理をお願いしたいのですが。',
    reading: 'すみません、○○がこわれてしまったので、しゅうりをおねがいしたいのですが。',
    context: {
      en: 'Use when something in your apartment is broken (hot water, AC, plumbing, etc.)',
      zh: '当公寓里有东西坏了（热水器、空调、管道等）时使用',
      ja: '部屋の設備が故障した時に使います',
    },
    branches: [
      {
        theyMightSay: 'いつ壊れましたか？',
        youRespond: '○日前から調子が悪くて、今日完全に動かなくなりました。',
        explanation: { en: 'They ask when it broke. Tell them when.', zh: '他们问什么时候坏的。告诉他们时间。', ja: 'いつ壊れたか聞かれています。' },
      },
      {
        theyMightSay: '業者を手配しますので、ご都合の良い日を教えてください。',
        youRespond: '○月○日の午前中が都合がいいです。',
        explanation: { en: 'They\'ll send a repair person. Give your available date.', zh: '他们会安排维修人员。告诉方便的日期。', ja: '修理業者を手配するので、都合の良い日を伝えます。' },
      },
    ],
    failures: [
      {
        situation: 'They say it\'s your responsibility to pay',
        jaPhrase: '契約書を確認させてください。入居時からあった設備なので、オーナー負担ではないでしょうか。',
        explanation: { en: 'Politely ask to check the contract — pre-existing equipment is usually the owner\'s responsibility.', zh: '礼貌地要求查看合同——入住前就有的设备通常是房东的责任。', ja: '契約書の確認を依頼します。' },
      },
    ],
    riskLevel: 'LOW',
  },
  {
    id: 'HOUSING-02',
    category: 'housing',
    subcategory: 'contract_renewal',
    title: {
      en: 'Negotiate lease renewal',
      zh: '协商续约',
      ja: '契約更新の相談',
    },
    openingLine: '契約更新について相談したいのですが、更新料と新しい条件を教えていただけますか。',
    reading: 'けいやくこうしんについてそうだんしたいのですが、こうしんりょうとあたらしいじょうけんをおしえていただけますか。',
    context: {
      en: 'Use 2-3 months before your lease expires to negotiate renewal terms',
      zh: '在租约到期前2-3个月使用，协商续约条件',
      ja: '契約満了の2-3ヶ月前に使います',
    },
    branches: [
      {
        theyMightSay: '更新料は家賃1ヶ月分です。',
        youRespond: '承知しました。家賃の変更はありますか。',
        explanation: { en: 'Renewal fee is 1 month\'s rent. Ask if rent will change.', zh: '续约费是一个月房租。问房租是否变动。', ja: '更新料は家賃1ヶ月分。家賃変更の有無を確認。' },
      },
    ],
    failures: [
      {
        situation: 'They refuse to negotiate',
        jaPhrase: '少し考えさせてください。後日改めてご連絡します。',
        explanation: { en: 'Buy time — say you need to think about it.', zh: '争取时间——说需要考虑一下。', ja: '考える時間をもらいます。' },
      },
    ],
    riskLevel: 'MEDIUM',
  },
  {
    id: 'HOUSING-03',
    category: 'housing',
    subcategory: 'deposit_return',
    title: {
      en: 'Request deposit return after move-out',
      zh: '退租后要求退还押金',
      ja: '退去後の敷金返還請求',
    },
    openingLine: '退去の精算について確認したいのですが、敷金の返還はいつ頃になりますか。',
    reading: 'たいきょのせいさんについてかくにんしたいのですが、しききんのへんかんはいつごろになりますか。',
    context: {
      en: 'Use after moving out to follow up on your deposit return',
      zh: '搬出后跟进押金退还情况时使用',
      ja: '退去後の敷金返還確認に使います',
    },
    branches: [
      {
        theyMightSay: '原状回復費用がかかりますので、敷金から差し引きます。',
        youRespond: '具体的な費用の明細を書面でいただけますか。',
        explanation: { en: 'They\'ll deduct restoration costs. Ask for an itemized receipt.', zh: '他们会扣除原状恢复费。要求提供详细清单。', ja: '原状回復費の明細を書面で求めます。' },
      },
    ],
    failures: [
      {
        situation: 'They charge unreasonable amounts',
        jaPhrase: '国土交通省のガイドラインでは、通常の経年変化は貸主負担とされています。明細を確認させてください。',
        explanation: { en: 'Cite the MLIT guidelines — normal wear and tear is the landlord\'s responsibility.', zh: '引用国土交通省指南——正常磨损是房东的责任。', ja: '国交省ガイドラインを引用して交渉します。' },
      },
    ],
    riskLevel: 'HIGH',
  },

  // ================================================================
  // Category 2: MUNICIPAL (行政手続き) — 3 scenarios
  // ================================================================
  {
    id: 'MUNICIPAL-01',
    category: 'municipal',
    subcategory: 'move_in_registration',
    title: {
      en: 'Register your new address at city hall',
      zh: '在区役所办理迁入登记',
      ja: '転入届の提出',
    },
    openingLine: '転入届を出したいのですが、必要な書類を教えてください。',
    reading: 'てんにゅうとどけをだしたいのですが、ひつようなしょるいをおしえてください。',
    context: {
      en: 'Use within 14 days of moving to a new address in Japan',
      zh: '搬到新地址后14天内使用',
      ja: '引っ越し後14日以内に使います',
    },
    branches: [
      {
        theyMightSay: '在留カードとパスポートをお持ちですか。',
        youRespond: 'はい、両方持っています。こちらです。',
        explanation: { en: 'They need your residence card and passport.', zh: '需要在留卡和护照。', ja: '在留カードとパスポートを提示します。' },
      },
    ],
    failures: [
      {
        situation: 'You don\'t have all documents',
        jaPhrase: 'すみません、○○を忘れてしまいました。他の書類だけ先に確認していただけますか。',
        explanation: { en: 'Apologize for missing document, ask to check others first.', zh: '为缺少文件道歉，请求先确认其他文件。', ja: '書類不足を謝り、他の書類の確認を依頼。' },
      },
    ],
    riskLevel: 'LOW',
  },
  {
    id: 'MUNICIPAL-02',
    category: 'municipal',
    subcategory: 'health_insurance',
    title: {
      en: 'Enroll in national health insurance',
      zh: '加入国民健康保险',
      ja: '国民健康保険の加入手続き',
    },
    openingLine: '国民健康保険に加入したいのですが、手続きの方法を教えてください。',
    reading: 'こくみんけんこうほけんにかにゅうしたいのですが、てつづきのほうほうをおしえてください。',
    context: {
      en: 'Use when you need to join NHI (freelancers, between jobs, etc.)',
      zh: '需要加入国保时使用（自由职业、换工作期间等）',
      ja: 'フリーランスや転職期間中にNHIに加入する時',
    },
    branches: [
      {
        theyMightSay: '前の保険の脱退証明書はお持ちですか。',
        youRespond: 'はい、こちらが脱退証明書です。',
        explanation: { en: 'They need proof you left previous insurance.', zh: '需要前保险的退保证明。', ja: '前の保険の脱退証明書を提示。' },
      },
    ],
    failures: [
      {
        situation: 'No proof of leaving previous insurance',
        jaPhrase: 'まだ届いていないのですが、届き次第持参してもよろしいでしょうか。',
        explanation: { en: 'Ask if you can bring it later when it arrives.', zh: '问能否等收到后再带来。', ja: '届き次第持参する旨を伝えます。' },
      },
    ],
    riskLevel: 'LOW',
  },
  {
    id: 'MUNICIPAL-03',
    category: 'municipal',
    subcategory: 'tax_filing',
    title: {
      en: 'Ask about tax filing (確定申告)',
      zh: '咨询报税（确定申告）',
      ja: '確定申告の相談',
    },
    openingLine: '確定申告について相談したいのですが、外国人の場合はどのような書類が必要ですか。',
    reading: 'かくていしんこくについてそうだんしたいのですが、がいこくじんのばあいはどのようなしょるいがひつようですか。',
    context: {
      en: 'Use during tax season (Feb-Mar) or when you need to file a tax return',
      zh: '报税季节（2-3月）或需要申报时使用',
      ja: '確定申告時期（2-3月）に使います',
    },
    branches: [
      {
        theyMightSay: '源泉徴収票はお持ちですか。',
        youRespond: 'はい、勤務先からもらった源泉徴収票があります。',
        explanation: { en: 'They need your withholding tax slip from your employer.', zh: '需要公司发的源泉征收票。', ja: '源泉徴収票を提示します。' },
      },
    ],
    failures: [
      {
        situation: 'Too complex for you to handle alone',
        jaPhrase: '少し複雑なので、英語（中国語）対応の税理士を紹介していただけますか。',
        explanation: { en: 'Ask for a tax accountant who speaks your language.', zh: '要求介绍会说中文的税理士。', ja: '外国語対応の税理士紹介を依頼。' },
      },
    ],
    riskLevel: 'MEDIUM',
  },

  // ================================================================
  // Category 3: UTILITIES (生活インフラ) — 3 scenarios
  // ================================================================
  {
    id: 'UTILITIES-01',
    category: 'utilities',
    subcategory: 'gas_activation',
    title: {
      en: 'Schedule gas activation (開栓)',
      zh: '预约开通燃气',
      ja: 'ガスの開栓予約',
    },
    openingLine: '引っ越しのため、ガスの開栓をお願いしたいのですが。',
    reading: 'ひっこしのため、ガスのかいせんをおねがいしたいのですが。',
    context: {
      en: 'Use before moving in — gas requires an in-person activation appointment',
      zh: '搬入前使用——燃气需要上门开通',
      ja: '引っ越し前にガス開栓の予約をします',
    },
    branches: [
      {
        theyMightSay: 'ご希望の日時はございますか。',
        youRespond: '○月○日の○時頃にお願いできますか。立ち会いは必要ですか。',
        explanation: { en: 'Give your preferred date/time, ask if you need to be present.', zh: '给出希望的日期时间，问是否需要在场。', ja: '希望日時を伝え、立ち会いの有無を確認。' },
      },
    ],
    failures: [
      {
        situation: 'You can\'t understand the automated phone menu',
        jaPhrase: 'すみません、日本語があまり得意ではありません。ゆっくり話していただけますか。',
        explanation: { en: 'Ask them to speak slowly.', zh: '请他们说慢一点。', ja: 'ゆっくり話してもらうよう依頼。' },
      },
    ],
    riskLevel: 'LOW',
  },
  {
    id: 'UTILITIES-02',
    category: 'utilities',
    subcategory: 'internet_setup',
    title: {
      en: 'Set up internet connection',
      zh: '办理网络开通',
      ja: 'インターネット回線の申し込み',
    },
    openingLine: 'インターネットの新規契約をしたいのですが、工事はいつ可能ですか。',
    reading: 'インターネットのしんきけいやくをしたいのですが、こうじはいつかのうですか。',
    context: {
      en: 'Use when moving in — fiber internet requires installation',
      zh: '搬入时使用——光纤网络需要施工安装',
      ja: '引っ越し時のインターネット開通手続き',
    },
    branches: [
      {
        theyMightSay: 'マンションタイプとファミリータイプがございますが。',
        youRespond: 'マンションに住んでいるので、マンションタイプでお願いします。',
        explanation: { en: 'They ask apartment or house type — choose apartment.', zh: '问公寓还是独栋——选公寓型。', ja: 'マンションタイプを選択。' },
      },
    ],
    failures: [
      {
        situation: 'Building doesn\'t support your preferred provider',
        jaPhrase: '建物に対応している回線を教えていただけますか。',
        explanation: { en: 'Ask which providers are available in your building.', zh: '问大楼支持哪些运营商。', ja: '対応回線を確認。' },
      },
    ],
    riskLevel: 'LOW',
  },
  {
    id: 'UTILITIES-03',
    category: 'utilities',
    subcategory: 'billing_dispute',
    title: {
      en: 'Dispute a utility bill',
      zh: '对水电费账单有异议',
      ja: '公共料金の請求に関する問い合わせ',
    },
    openingLine: '先月の請求金額が通常より高いのですが、明細を確認させていただけますか。',
    reading: 'せんげつのせいきゅうきんがくがつうじょうよりたかいのですが、めいさいをかくにんさせていただけますか。',
    context: {
      en: 'Use when your bill seems unusually high',
      zh: '当账单金额异常偏高时使用',
      ja: '請求金額が異常に高い時に使います',
    },
    branches: [
      {
        theyMightSay: '検針日と使用量を確認しますので、お客様番号を教えてください。',
        youRespond: 'お客様番号は○○○です。',
        explanation: { en: 'Give them your customer number (on the bill).', zh: '告诉他们客户编号（在账单上）。', ja: 'お客様番号を伝えます。' },
      },
    ],
    failures: [
      {
        situation: 'They insist the reading is correct',
        jaPhrase: '漏水の可能性はありませんか。点検をお願いできますか。',
        explanation: { en: 'Ask about possible water leak and request an inspection.', zh: '问是否可能漏水，要求检查。', ja: '漏水の可能性を確認し、点検を依頼。' },
      },
    ],
    riskLevel: 'MEDIUM',
  },

  // ================================================================
  // Category 4: EMERGENCY (緊急対応) — 3 scenarios
  // ================================================================
  {
    id: 'EMERGENCY-01',
    category: 'emergency',
    subcategory: 'medical',
    title: {
      en: 'Call a hospital / describe symptoms',
      zh: '打电话给医院/描述症状',
      ja: '病院への電話・症状の説明',
    },
    openingLine: '具合が悪いので、診察の予約をお願いしたいのですが。症状は○○です。',
    reading: 'ぐあいがわるいので、しんさつのよやくをおねがいしたいのですが。しょうじょうは○○です。',
    context: {
      en: 'Use when you need to see a doctor but it\'s not life-threatening',
      zh: '需要看医生但不是危及生命的情况时使用',
      ja: '救急ではないが医者にかかりたい時',
    },
    branches: [
      {
        theyMightSay: '保険証はお持ちですか。',
        youRespond: 'はい、国民健康保険証を持っています。',
        explanation: { en: 'They need your insurance card.', zh: '需要保险证。', ja: '保険証を持っていることを伝えます。' },
      },
    ],
    failures: [
      {
        situation: 'They don\'t have English-speaking staff',
        jaPhrase: '通訳サービスはありますか。または、英語（中国語）が話せるスタッフはいますか。',
        explanation: { en: 'Ask about interpretation services.', zh: '询问是否有翻译服务。', ja: '通訳サービスの有無を確認。' },
      },
    ],
    riskLevel: 'MEDIUM',
  },
  {
    id: 'EMERGENCY-02',
    category: 'emergency',
    subcategory: 'police_report',
    title: {
      en: 'File a police report (lost item / theft)',
      zh: '报警（遗失/被盗）',
      ja: '警察への届出（遺失届・被害届）',
    },
    openingLine: '○○を紛失（盗難に遭い）ましたので、届出をしたいのですが。',
    reading: '○○をふんしつ（とうなんにあい）ましたので、とどけでをしたいのですが。',
    context: {
      en: 'Use when you lost something or it was stolen — you need a police report for insurance',
      zh: '丢失东西或被盗时使用——保险理赔需要报警证明',
      ja: '紛失・盗難時に警察への届出が必要な場合',
    },
    branches: [
      {
        theyMightSay: 'いつ、どこで無くなりましたか。',
        youRespond: '○月○日の○時頃、○○で気づきました。',
        explanation: { en: 'Tell them when and where you noticed it was missing.', zh: '告诉他们什么时候在哪里发现丢失的。', ja: 'いつどこで気づいたかを伝えます。' },
      },
    ],
    failures: [
      {
        situation: 'Language barrier is too severe',
        jaPhrase: '英語（中国語）が話せる方はいらっしゃいますか。または通訳を呼んでいただけますか。',
        explanation: { en: 'Ask for an English/Chinese speaker or interpreter.', zh: '要求英语/中文翻译。', ja: '外国語対応を依頼。' },
      },
    ],
    riskLevel: 'LOW',
  },
  {
    id: 'EMERGENCY-03',
    category: 'emergency',
    subcategory: 'landlord_dispute',
    title: {
      en: 'Escalate a serious dispute with landlord',
      zh: '与房东的严重纠纷升级处理',
      ja: '大家との深刻なトラブルの相談',
    },
    openingLine: '賃貸トラブルについて相談したいのですが、消費者センターに電話しています。',
    reading: 'ちんたいトラブルについてそうだんしたいのですが、しょうひしゃセンターにでんわしています。',
    context: {
      en: 'Use when your landlord is acting illegally (illegal eviction, refusing deposit return, etc.)',
      zh: '当房东有违法行为时使用（非法驱逐、拒绝退还押金等）',
      ja: '大家が違法行為をしている場合に消費者センターに相談',
    },
    branches: [
      {
        theyMightSay: '具体的な状況を教えてください。',
        youRespond: '○○という状況で、大家から○○と言われました。契約書はこちらにあります。',
        explanation: { en: 'Describe the situation and mention you have the contract.', zh: '描述情况并说明你有合同。', ja: '状況を説明し、契約書があることを伝えます。' },
      },
    ],
    failures: [
      {
        situation: 'Consumer center says you need a lawyer',
        jaPhrase: '弁護士に相談する場合、法テラス（法律支援センター）を利用できますか。',
        explanation: { en: 'Ask about Legal Aid (Houterasu) for free legal consultations.', zh: '询问法律援助中心（法Terrace）的免费法律咨询。', ja: '法テラスの利用について確認します。' },
      },
    ],
    riskLevel: 'HIGH',
  },
]

// ---------------------------------------------------------------------
// Pure: lookup functions.
// ---------------------------------------------------------------------

/**
 * Get all scenarios for a category.
 */
export function getScenariosByCategory(category: ScenarioCategory): ScenarioTemplate[] {
  return SCENARIOS.filter((s) => s.category === category)
}

/**
 * Get a scenario by ID.
 */
export function getScenarioById(id: string): ScenarioTemplate | null {
  return SCENARIOS.find((s) => s.id === id) ?? null
}

/**
 * Get all unique categories with counts.
 */
export function getScenarioCategories(): Array<{ category: ScenarioCategory; count: number }> {
  const counts = new Map<ScenarioCategory, number>()
  for (const s of SCENARIOS) {
    counts.set(s.category, (counts.get(s.category) ?? 0) + 1)
  }
  return Array.from(counts.entries()).map(([category, count]) => ({ category, count }))
}

/**
 * Search scenarios by keyword (matches title in any language or context).
 */
export function searchScenarios(query: string): ScenarioTemplate[] {
  const q = query.toLowerCase()
  return SCENARIOS.filter((s) => {
    const searchable = [
      s.title.en, s.title.zh, s.title.ja,
      s.context.en, s.context.zh, s.context.ja,
      s.subcategory, s.openingLine,
    ].join(' ').toLowerCase()
    return searchable.includes(q)
  })
}
