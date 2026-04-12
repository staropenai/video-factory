/**
 * JTG V5 改进3 — Four-layer friction reduction framework.
 *
 * Based on behavioral economics (Kahneman, 2011) and nudge theory
 * (Thaler & Sunstein, 2008), phone-call scenarios for foreigners
 * in Japan have four friction layers:
 *
 *   Layer 1: 起步成本 (initiation cost) — "I don't know where to start"
 *   Layer 2: 执行成本 (execution cost) — "I don't know what to say"
 *   Layer 3: 失败成本 (failure cost) — "What if they don't understand me"
 *   Layer 4: 决策成本 (decision cost) — "Which option should I choose"
 *
 * Each PhoneScenario explicitly addresses all four layers:
 *   L1 → category + subcategory selection (reduce choice paralysis)
 *   L2 → opening + branches (scripted conversation flow)
 *   L3 → failureHandlers (recovery from common failure modes)
 *   L4 → defaultSuggestion (nudge: always show a next step)
 *
 * 4 categories × 3+ subcategories = 14 scenarios.
 * All data is pure. No I/O.
 */

// ---------------------------------------------------------------------
// Types.
// ---------------------------------------------------------------------

export type FrictionCategory = 'lease' | 'equipment' | 'utilities' | 'moveout'

export interface LocalizedText {
  ja: string
  romaji: string
  zh: string
}

export interface ConversationBranch {
  /** What the other party might say (Japanese). */
  trigger: string
  /** How to respond. */
  response: LocalizedText
}

export interface FailureHandlers {
  /** They didn't understand you. */
  notUnderstood: LocalizedText
  /** You called the wrong number. */
  wrongNumber: LocalizedText
  /** No one answered. */
  noAnswer: { nextSteps: string[] }
}

export interface PhoneScenario {
  id: string
  /** Layer 1: reduce initiation cost — categorize the task. */
  category: FrictionCategory
  subcategory: string
  title: LocalizedText
  /** Layer 2: reduce execution cost — scripted opening + responses. */
  opening: LocalizedText
  branches: ConversationBranch[]
  /** Layer 3: reduce failure cost — recovery templates. */
  failureHandlers: FailureHandlers
  /** Layer 4: reduce decision cost — always show a default next action. */
  defaultSuggestion: string
}

// ---------------------------------------------------------------------
// Shared failure handlers (reused across scenarios).
// ---------------------------------------------------------------------

const SHARED_NOT_UNDERSTOOD: LocalizedText = {
  ja: 'すみません、日本語があまり上手ではありません。もう少しゆっくり話していただけますか。',
  romaji: 'Sumimasen, nihongo ga amari jouzu dewa arimasen. Mou sukoshi yukkuri hanashite itadakemasu ka.',
  zh: '对不起，我日语不太好。能请您说慢一点吗？',
}

const SHARED_WRONG_NUMBER: LocalizedText = {
  ja: '失礼しました。番号を間違えたようです。失礼します。',
  romaji: 'Shitsurei shimashita. Bangou wo machigaeta you desu. Shitsurei shimasu.',
  zh: '抱歉，好像打错号码了。失礼了。',
}

// ---------------------------------------------------------------------
// Scenario data: 4 categories × 3-4 subcategories = 14 scenarios.
// ---------------------------------------------------------------------

export const FRICTION_SCENARIOS: PhoneScenario[] = [
  // ================================================================
  // Category 1: LEASE (租約相関) — 4 scenarios
  // ================================================================
  {
    id: 'LEASE-01',
    category: 'lease',
    subcategory: 'renewal',
    title: { ja: '契約更新の相談', romaji: 'Keiyaku koushin no soudan', zh: '续约咨询' },
    opening: {
      ja: 'お世話になっております。契約更新について相談したいのですが、更新料と条件を教えていただけますか。',
      romaji: 'Osewa ni natte orimasu. Keiyaku koushin ni tsuite soudan shitai no desu ga, koushinryou to jouken wo oshiete itadakemasu ka.',
      zh: '您好。我想咨询续约事宜，能告诉我续约费和条件吗？',
    },
    branches: [
      {
        trigger: '更新料は家賃1ヶ月分です',
        response: { ja: '承知しました。家賃の変更はありますか。', romaji: 'Shouchi shimashita. Yachin no henkou wa arimasu ka.', zh: '明白了。房租有变动吗？' },
      },
      {
        trigger: '更新しない場合は退去届が必要です',
        response: { ja: '退去届の期限はいつまでですか。', romaji: 'Taikyo todoke no kigen wa itsu made desu ka.', zh: '退租通知的截止日期是什么时候？' },
      },
    ],
    failureHandlers: {
      notUnderstood: SHARED_NOT_UNDERSTOOD,
      wrongNumber: SHARED_WRONG_NUMBER,
      noAnswer: { nextSteps: ['管理会社の営業時間を確認して、営業時間内にかけ直す', '不動産屋の店舗に直接行く'] },
    },
    defaultSuggestion: '先に契約書の更新条項を確認してから電話しましょう。更新料は通常家賃1ヶ月分です。',
  },
  {
    id: 'LEASE-02',
    category: 'lease',
    subcategory: 'termination',
    title: { ja: '解約（退去）の連絡', romaji: 'Kaiyaku (taikyo) no renraku', zh: '退租通知' },
    opening: {
      ja: '退去を考えているのですが、退去届の提出方法と期限を教えていただけますか。',
      romaji: 'Taikyo wo kangaete iru no desu ga, taikyo todoke no teishutsu houhou to kigen wo oshiete itadakemasu ka.',
      zh: '我在考虑退租，能告诉我退租通知的提交方法和截止日期吗？',
    },
    branches: [
      {
        trigger: '退去日の1ヶ月前までに届出が必要です',
        response: { ja: '書面での届出ですか、それとも電話でも大丈夫ですか。', romaji: 'Shomen de no todokede desu ka, soretomo denwa demo daijoubu desu ka.', zh: '需要书面通知还是电话也可以？' },
      },
    ],
    failureHandlers: {
      notUnderstood: SHARED_NOT_UNDERSTOOD,
      wrongNumber: SHARED_WRONG_NUMBER,
      noAnswer: { nextSteps: ['メールで退去意思を伝える（書面記録になる）', '内容証明郵便で送る（法的証拠になる）'] },
    },
    defaultSuggestion: '退去届は通常1-2ヶ月前に提出。まず契約書の「解約予告期間」を確認してください。',
  },
  {
    id: 'LEASE-03',
    category: 'lease',
    subcategory: 'dispute',
    title: { ja: '賃貸トラブルの相談', romaji: 'Chintai trouble no soudan', zh: '租赁纠纷咨询' },
    opening: {
      ja: '賃貸に関するトラブルでご相談したいのですが。状況を説明してもよろしいですか。',
      romaji: 'Chintai ni kansuru trouble de go-soudan shitai no desu ga. Joukyou wo setsumei shite mo yoroshii desu ka.',
      zh: '我想咨询租赁方面的纠纷。可以说明一下情况吗？',
    },
    branches: [
      {
        trigger: '具体的にどのような問題ですか',
        response: { ja: '○○という状況です。契約書はこちらにあります。', romaji: '○○ to iu joukyou desu. Keiyakusho wa kochira ni arimasu.', zh: '情况是○○。我这里有合同。' },
      },
    ],
    failureHandlers: {
      notUnderstood: SHARED_NOT_UNDERSTOOD,
      wrongNumber: SHARED_WRONG_NUMBER,
      noAnswer: { nextSteps: ['消費者センター（188）に電話する', '法テラス（0570-078374）に無料相談する'] },
    },
    defaultSuggestion: '契約書と問題の経緯を時系列でメモしてから電話しましょう。証拠（写真・メール）も準備。',
  },

  // ================================================================
  // Category 2: EQUIPMENT (設備故障) — 4 scenarios
  // ================================================================
  {
    id: 'EQUIP-01',
    category: 'equipment',
    subcategory: 'no_hot_water',
    title: { ja: 'お湯が出ない', romaji: 'Oyu ga denai', zh: '没有热水' },
    opening: {
      ja: 'すみません、お湯が出なくなりました。給湯器の修理をお願いしたいのですが。',
      romaji: 'Sumimasen, oyu ga denakunarimashita. Kyuutouki no shuuri wo onegai shitai no desu ga.',
      zh: '不好意思，热水出不来了。想请修一下热水器。',
    },
    branches: [
      {
        trigger: 'エラーコードは表示されていますか',
        response: { ja: '画面に○○と表示されています。', romaji: 'Gamen ni ○○ to hyouji sarete imasu.', zh: '屏幕上显示○○。' },
      },
      {
        trigger: '業者を手配しますので、ご都合の良い日を教えてください',
        response: { ja: '○月○日の午前中が都合がいいです。立ち会いは必要ですか。', romaji: '○gatsu ○nichi no gozen-chuu ga tsugou ga ii desu. Tachiai wa hitsuyou desu ka.', zh: '○月○日上午方便。需要在场吗？' },
      },
    ],
    failureHandlers: {
      notUnderstood: SHARED_NOT_UNDERSTOOD,
      wrongNumber: SHARED_WRONG_NUMBER,
      noAnswer: { nextSteps: ['ガス会社の緊急連絡先に電話する', '給湯器メーカーのサポートに連絡する'] },
    },
    defaultSuggestion: '先に給湯器のメーカーと型番を確認。リモコンにエラーコードが表示されていればメモしておく。',
  },
  {
    id: 'EQUIP-02',
    category: 'equipment',
    subcategory: 'no_electricity',
    title: { ja: '電気がつかない', romaji: 'Denki ga tsukanai', zh: '没有电' },
    opening: {
      ja: '部屋の電気がつかなくなりました。ブレーカーは確認しましたが復旧しません。',
      romaji: 'Heya no denki ga tsukanaku narimashita. Breaker wa kakunin shimashita ga fukkyuu shimasen.',
      zh: '房间的电不亮了。已经检查了断路器但没恢复。',
    },
    branches: [
      {
        trigger: 'ブレーカーは上がっていますか',
        response: { ja: 'はい、全部上がっていますが電気がつきません。', romaji: 'Hai, zenbu agatte imasu ga denki ga tsukimasen.', zh: '是的，都打开了但还是没电。' },
      },
    ],
    failureHandlers: {
      notUnderstood: SHARED_NOT_UNDERSTOOD,
      wrongNumber: SHARED_WRONG_NUMBER,
      noAnswer: { nextSteps: ['電力会社のカスタマーセンターに連絡', '管理会社の緊急連絡先に電話'] },
    },
    defaultSuggestion: 'まずブレーカーを全部切って→メインから順に入れ直す。それでもダメなら管理会社に連絡。',
  },
  {
    id: 'EQUIP-03',
    category: 'equipment',
    subcategory: 'wifi_trouble',
    title: { ja: 'WiFiが繋がらない', romaji: 'WiFi ga tsunagaranai', zh: 'WiFi连不上' },
    opening: {
      ja: 'インターネットが繋がらなくなりました。ルーターの再起動はしましたが改善しません。',
      romaji: 'Internet ga tsunagaranaku narimashita. Router no saikidou wa shimashita ga kaizen shimasen.',
      zh: '网络连不上了。已经重启了路由器但没有改善。',
    },
    branches: [
      {
        trigger: 'ルーターのランプの状態を教えてください',
        response: { ja: '○○のランプが○色で点滅しています。', romaji: '○○ no lamp ga ○iro de tenmetsu shite imasu.', zh: '○○的灯是○色闪烁。' },
      },
    ],
    failureHandlers: {
      notUnderstood: SHARED_NOT_UNDERSTOOD,
      wrongNumber: SHARED_WRONG_NUMBER,
      noAnswer: { nextSteps: ['プロバイダーのWebサイトで障害情報を確認', 'モバイルデータでテザリングして一時的に凌ぐ'] },
    },
    defaultSuggestion: 'ルーターの電源を抜いて30秒待ってから入れ直す。ONUとルーター両方。ランプの状態をメモ。',
  },

  // ================================================================
  // Category 3: UTILITIES (水電網) — 3 scenarios
  // ================================================================
  {
    id: 'UTIL-01',
    category: 'utilities',
    subcategory: 'start_service',
    title: { ja: '水道・電気・ガスの開通', romaji: 'Suidou denki gas no kaitsuu', zh: '水电气开通' },
    opening: {
      ja: '引っ越しのため、○○の使用開始手続きをお願いしたいのですが。入居日は○月○日です。',
      romaji: 'Hikkoshi no tame, ○○ no shiyou kaishi tetsuzuki wo onegai shitai no desu ga. Nyuukyo-bi wa ○gatsu ○nichi desu.',
      zh: '因为搬家，想办理○○的开通手续。入住日是○月○日。',
    },
    branches: [
      {
        trigger: 'お客様番号はございますか',
        response: { ja: 'まだありません。新規の申し込みです。', romaji: 'Mada arimasen. Shinki no moushikomi desu.', zh: '还没有。是新申请。' },
      },
      {
        trigger: '立ち会いが必要です',
        response: { ja: '何時頃がよろしいですか。午前と午後どちらが空いていますか。', romaji: 'Nanji goro ga yoroshii desu ka. Gozen to gogo dochira ga aite imasu ka.', zh: '大概几点？上午和下午哪个有空？' },
      },
    ],
    failureHandlers: {
      notUnderstood: SHARED_NOT_UNDERSTOOD,
      wrongNumber: SHARED_WRONG_NUMBER,
      noAnswer: { nextSteps: ['Webサイトから申し込む（電気・水道はオンライン可能な場合が多い）', '不動産屋に代行を依頼する'] },
    },
    defaultSuggestion: '入居日の1週間前までに手続き。ガスは立ち会い必須。電気と水道はWebでも申込可能な場合が多い。',
  },
  {
    id: 'UTIL-02',
    category: 'utilities',
    subcategory: 'change_plan',
    title: { ja: 'プラン変更・名義変更', romaji: 'Plan henkou meigi henkou', zh: '变更套餐/过户' },
    opening: {
      ja: '契約内容の変更をお願いしたいのですが。○○の変更は可能ですか。',
      romaji: 'Keiyaku naiyou no henkou wo onegai shitai no desu ga. ○○ no henkou wa kanou desu ka.',
      zh: '想变更合同内容。○○可以变更吗？',
    },
    branches: [
      {
        trigger: 'ご本人確認が必要です',
        response: { ja: '在留カードと現在の契約番号で大丈夫ですか。', romaji: 'Zairyuu card to genzai no keiyaku bangou de daijoubu desu ka.', zh: '在留卡和现在的合同号可以吗？' },
      },
    ],
    failureHandlers: {
      notUnderstood: SHARED_NOT_UNDERSTOOD,
      wrongNumber: SHARED_WRONG_NUMBER,
      noAnswer: { nextSteps: ['Webのマイページから変更手続きを試す', '最寄りの営業所に直接行く'] },
    },
    defaultSuggestion: '現在の契約番号とお客様番号を手元に準備してから電話。在留カードも必要な場合あり。',
  },
  {
    id: 'UTIL-03',
    category: 'utilities',
    subcategory: 'stop_service',
    title: { ja: '水道・電気・ガスの停止', romaji: 'Suidou denki gas no teishi', zh: '水电气停止' },
    opening: {
      ja: '引っ越しのため、○○の使用停止手続きをお願いしたいのですが。退去日は○月○日です。',
      romaji: 'Hikkoshi no tame, ○○ no shiyou teishi tetsuzuki wo onegai shitai no desu ga. Taikyo-bi wa ○gatsu ○nichi desu.',
      zh: '因为搬家，想办理○○的停止手续。退租日是○月○日。',
    },
    branches: [
      {
        trigger: '最終検針日を設定しますが',
        response: { ja: '退去日と同じ○月○日でお願いします。', romaji: 'Taikyo-bi to onaji ○gatsu ○nichi de onegai shimasu.', zh: '请设定跟退租日一样的○月○日。' },
      },
    ],
    failureHandlers: {
      notUnderstood: SHARED_NOT_UNDERSTOOD,
      wrongNumber: SHARED_WRONG_NUMBER,
      noAnswer: { nextSteps: ['Webから停止手続き', '退去日に現地で検針立ち会い'] },
    },
    defaultSuggestion: '退去日の1週間前までに停止手続き。ガスは閉栓立ち会い不要の場合が多い。最終請求の送付先を伝える。',
  },

  // ================================================================
  // Category 4: MOVEOUT (搬家・退租) — 3 scenarios
  // ================================================================
  {
    id: 'MOVE-01',
    category: 'moveout',
    subcategory: 'notice',
    title: { ja: '退去通知の連絡', romaji: 'Taikyo tsuuchi no renraku', zh: '退租通知' },
    opening: {
      ja: '○月末で退去を希望しています。退去届の提出方法を教えてください。',
      romaji: '○gatsu matsu de taikyo wo kibou shite imasu. Taikyo todoke no teishutsu houhou wo oshiete kudasai.',
      zh: '希望在○月底退租。请告诉我退租通知的提交方法。',
    },
    branches: [
      {
        trigger: '書面での届出をお願いします',
        response: { ja: '書式はありますか。それとも自由形式で大丈夫ですか。', romaji: 'Shoshiki wa arimasu ka. Soretomo jiyuu keishiki de daijoubu desu ka.', zh: '有固定格式吗？还是自由格式就可以？' },
      },
    ],
    failureHandlers: {
      notUnderstood: SHARED_NOT_UNDERSTOOD,
      wrongNumber: SHARED_WRONG_NUMBER,
      noAnswer: { nextSteps: ['内容証明郵便で退去届を送る（法的証拠）', '管理会社の事務所に直接持参する'] },
    },
    defaultSuggestion: '契約書の「解約予告期間」を確認（通常1-2ヶ月前）。電話の後、必ず書面でも提出。',
  },
  {
    id: 'MOVE-02',
    category: 'moveout',
    subcategory: 'key_return',
    title: { ja: '鍵の返却', romaji: 'Kagi no henkyaku', zh: '钥匙归还' },
    opening: {
      ja: '退去に伴う鍵の返却方法を確認したいのですが。返却先と期限を教えてください。',
      romaji: 'Taikyo ni tomonau kagi no henkyaku houhou wo kakunin shitai no desu ga. Henkyaku-saki to kigen wo oshiete kudasai.',
      zh: '想确认退租时钥匙的归还方法。请告诉我归还地点和截止日期。',
    },
    branches: [
      {
        trigger: '退去日当日に管理会社に返却してください',
        response: { ja: '当日何時まで大丈夫ですか。また、スペアキーも全て返却ですか。', romaji: 'Toujitsu nanji made daijoubu desu ka. Mata, spare key mo subete henkyaku desu ka.', zh: '当天几点之前可以？另外，备用钥匙也要全部归还吗？' },
      },
    ],
    failureHandlers: {
      notUnderstood: SHARED_NOT_UNDERSTOOD,
      wrongNumber: SHARED_WRONG_NUMBER,
      noAnswer: { nextSteps: ['管理会社のポストに鍵を入れる（記録写真を撮る）', '宅配便で送る（追跡番号を保存）'] },
    },
    defaultSuggestion: '受け取ったすべての鍵（メインキー＋スペアキー）を準備。返却時に写真を撮って証拠を残す。',
  },
  {
    id: 'MOVE-03',
    category: 'moveout',
    subcategory: 'cleaning_inspection',
    title: { ja: '退去時の立会い・清掃確認', romaji: 'Taikyo-ji no tachiai seisou kakunin', zh: '退租验房/清扫确认' },
    opening: {
      ja: '退去時の立会い検査の日程を相談したいのですが。いつが可能ですか。',
      romaji: 'Taikyo-ji no tachiai kensa no nittei wo soudan shitai no desu ga. Itsu ga kanou desu ka.',
      zh: '想商量退租验房的日期。什么时候可以？',
    },
    branches: [
      {
        trigger: '退去日に立ち会いを行います',
        response: { ja: '承知しました。事前にクリーニングは必要ですか。', romaji: 'Shouchi shimashita. Jizen ni cleaning wa hitsuyou desu ka.', zh: '明白了。需要提前请清洁公司吗？' },
      },
      {
        trigger: '原状回復費用が発生する可能性があります',
        response: { ja: '費用の明細を書面でいただけますか。国土交通省のガイドラインに基づいて確認したいです。', romaji: 'Hiyou no meisai wo shomen de itadakemasu ka. Kokudo-koutsuu-shou no guideline ni motozuite kakunin shitai desu.', zh: '能给我费用明细的书面材料吗？我想按照国土交通省的指南确认。' },
      },
    ],
    failureHandlers: {
      notUnderstood: SHARED_NOT_UNDERSTOOD,
      wrongNumber: SHARED_WRONG_NUMBER,
      noAnswer: { nextSteps: ['退去前に部屋の状態を写真・動画で記録（日付入り）', '清掃はハウスクリーニング業者に依頼（領収書保管）'] },
    },
    defaultSuggestion: '退去前に部屋の隅々を写真撮影（日付表示）。通常の経年変化は貸主負担。国交省ガイドラインを確認。',
  },
]

// ---------------------------------------------------------------------
// Pure: lookup functions.
// ---------------------------------------------------------------------

/**
 * Get all scenarios for a category.
 */
export function getScenariosByFrictionCategory(
  category: FrictionCategory,
): PhoneScenario[] {
  return FRICTION_SCENARIOS.filter((s) => s.category === category)
}

/**
 * Get a specific scenario by category + subcategory.
 * Returns null if no exact match.
 */
export function getFrictionReducedScenario(
  category: FrictionCategory,
  subcategory: string,
): PhoneScenario | null {
  return (
    FRICTION_SCENARIOS.find(
      (s) => s.category === category && s.subcategory === subcategory,
    ) ?? null
  )
}

/**
 * Get the default (first) scenario for a category.
 * Always returns a value — every category has at least one scenario.
 */
export function getDefaultScenarioForCategory(
  category: FrictionCategory,
): PhoneScenario {
  const scenarios = getScenariosByFrictionCategory(category)
  // Safety: every category has at least 3 scenarios by construction.
  return scenarios[0]
}

/**
 * Get all categories with their scenario counts.
 */
export function getFrictionCategories(): Array<{
  category: FrictionCategory
  count: number
  subcategories: string[]
}> {
  const map = new Map<FrictionCategory, string[]>()
  for (const s of FRICTION_SCENARIOS) {
    const subs = map.get(s.category) ?? []
    subs.push(s.subcategory)
    map.set(s.category, subs)
  }
  return Array.from(map.entries()).map(([category, subcategories]) => ({
    category,
    count: subcategories.length,
    subcategories,
  }))
}

/**
 * Search friction scenarios by keyword (matches title or subcategory in any language).
 */
export function searchFrictionScenarios(query: string): PhoneScenario[] {
  const q = query.toLowerCase()
  return FRICTION_SCENARIOS.filter((s) => {
    const searchable = [
      s.title.ja, s.title.romaji, s.title.zh,
      s.subcategory, s.opening.ja, s.opening.zh,
    ].join(' ').toLowerCase()
    return searchable.includes(q)
  })
}
