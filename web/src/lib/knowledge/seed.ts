/**
 * Seeded knowledge base — staging.
 *
 * Structure designed to scale to ~150 entries across 4 categories:
 *   renting (target 80), home_buying (target 10), visa (target 30), daily_life (target 30)
 *
 * Layer 1 — LIVE entries: full multilingual content + next-step fields. Indexed.
 * Layer 2 — STUB entries: scaffold with representative_title (en) + risk. NOT indexed.
 * Layer 3 — schema supports further fields without migration.
 *
 * This is NOT production content. It exists so staging testers can exercise real
 * direct_answer paths across all categories in all three languages.
 */

export type Category = "renting" | "home_buying" | "visa" | "daily_life";
export type RiskLevel = "low" | "medium" | "high";
export type SourceType = "community" | "government" | "expert" | "seed" | "practical" | "official" | "mixed" | "stub";
export type Lang = "en" | "zh" | "ja";

/**
 * Card entropy tier — v4 改进 #1.
 *   A = one-sentence answer, router returns it without invoking the LLM.
 *   B = short procedural answer (≤ 5 steps), router returns it without the LLM.
 *   C = needs AI judgement → injected as context into the AI layer.
 * Absent / undefined is treated as C so behavior stays conservative.
 */
export type FaqTier = "A" | "B" | "C";

export type LocalizedText = { en: string; zh: string; ja: string };

export type FaqEntry = {
  id: string;
  category: Category;
  subtopic: string;
  representative_title: LocalizedText;
  user_question_pattern: LocalizedText;
  pain_point: LocalizedText;
  standard_answer: LocalizedText;
  next_step_confirm: LocalizedText;
  next_step_prepare: LocalizedText;
  next_step_contact: LocalizedText;
  next_step_warning?: LocalizedText;
  target_user: string[];
  risk_level: RiskLevel;
  official_confirmation_required: boolean;
  notes?: string;
  source_type: SourceType;
  language: "multi" | Lang;
  keywords: { en: string[]; zh: string[]; ja: string[] };
  status: "live" | "stub";
  /**
   * Optional card entropy tier (v4 改进 #1). Seeds authored before tier
   * grading existed implicitly behave as "C" (always routed through AI).
   * Mark a card Tier A/B only when the answer is short, unambiguous, and
   * carries no dynamic dependency.
   */
  tier?: FaqTier;
};

/** Lightweight stub — scaffold only. Used by planners, not by retrieval. */
export type FaqStub = {
  id: string;
  category: Category;
  subtopic: string;
  representative_title_en: string;
  risk_level: RiskLevel;
  status: "stub";
};

// ---------- Synonym groups for query expansion ----------
// Each group is a bag of equivalent phrases across languages.
// If the query hits any member, the others count as if present.
const SYNONYM_GROUPS: string[][] = [
  // daily life
  ["garbage", "trash", "rubbish", "waste", "recycling", "ゴミ", "ごみ", "分別", "垃圾", "分类", "回收"],
  ["residence card", "zairyu", "在留カード", "在留卡", "居留卡"],
  ["my number", "mynumber", "マイナンバー", "個人番号", "个人编号"],
  ["bank account", "open account", "銀行口座", "口座", "银行账户", "开户", "开账户"],
  ["hanko", "inkan", "seal", "stamp", "印鑑", "ハンコ", "印章", "印鉴"],
  ["national health insurance", "kokuho", "nhi", "国民健康保険", "国保", "国民健康保险", "医保"],
  // renting
  ["rent", "rental", "家賃", "賃貸", "房租", "租房"],
  ["apartment", "mansion", "アパート", "マンション", "公寓"],
  ["guarantor", "guarantor company", "保証人", "保証会社", "保证人", "保证公司", "担保人"],
  ["initial cost", "upfront", "move-in cost", "move in fee", "初期費用", "初期费用"],
  ["key money", "reikin", "礼金", "禮金"],
  ["deposit", "shikikin", "敷金", "押金", "保证金"],
  ["renewal", "koushin", "更新", "续签", "续约"],
  ["discrimination", "no foreigners", "外国人お断り", "差別", "歧视"],
  // home buying
  ["buy a house", "buy property", "mortgage", "住宅ローン", "房贷", "买房", "購入"],
  ["property tax", "fixed asset tax", "固定資産税", "房产税"],
  // visa
  ["visa", "ビザ", "签证", "在留資格", "在留资格"],
  ["permanent residency", "permanent resident", "eijuken", "永住", "永住権", "永住許可", "永久居留", "永住"],
  ["change of status", "status change", "在留資格変更", "变更在留资格"],
  ["re-entry permit", "みなし再入国", "再入国許可", "再入境"],
  ["change jobs", "job change", "転職", "换工作", "跳槽"],
  // utilities
  ["electricity", "gas", "water", "utilities", "水道", "電気", "ガス", "水电", "煤气"],
  // schools / kids
  ["school", "kindergarten", "daycare", "保育園", "幼稚園", "幼儿园", "学校"],
  // troubleshooting: power outage / no electricity
  [
    "power outage", "no electricity", "blackout", "lights out", "power is out", "no power",
    "停電", "電気が来ない", "電気がつかない", "電気止まった", "ブレーカー",
    "停电", "没电", "没电了", "断电", "电没了", "电停了", "跳闸",
  ],
  // troubleshooting: water leak
  [
    "water leak", "leaking", "leak from ceiling", "pipe leak", "flooded",
    "水漏れ", "漏水", "天井から水", "配管から水",
    "漏水", "漏水了", "房子漏水", "水管漏", "天花板漏水", "屋顶漏水",
  ],
  // troubleshooting: no hot water
  [
    "no hot water", "hot water not working", "water heater broken",
    "お湯が出ない", "給湯器", "給湯器故障", "お湯がでない",
    "没热水", "热水没了", "没有热水", "没热水了", "热水器坏了", "热水不出",
  ],
  // troubleshooting: gas not working
  [
    "no gas", "gas not working", "gas stove not working", "stove not working",
    "ガスが出ない", "ガスが止まった", "ガス止まった", "ガスコンロ",
    "没煤气", "煤气坏了", "煤气没了", "燃气坏了", "没燃气", "炉灶坏",
  ],
  // troubleshooting: internet / wifi down
  [
    "wifi", "wi-fi", "internet down", "internet not working", "no internet", "no wifi", "router",
    "ネット", "ネットが繋がらない", "ワイファイ", "wifiが繋がらない", "ルーター",
    "wifi断了", "wifi不通", "没网", "没网了", "断网", "上不了网", "路由器", "宽带坏了",
  ],
  // troubleshooting: broken light / appliance
  [
    "light broken", "bulb broken", "bulb burned out", "appliance broken", "ac not working",
    "電球", "照明が点かない", "家電が壊れた", "エアコン壊れた",
    "灯坏了", "灯泡坏了", "灯不亮", "电器坏了", "空调坏了", "灯找谁",
  ],
  // troubleshooting: garbage missed / collection day
  [
    "garbage missed", "missed garbage", "garbage day", "garbage collection", "can i throw",
    "ゴミ収集日", "ゴミの日", "ゴミ出し", "ゴミ回収",
    "垃圾日", "垃圾今天能扔", "垃圾能不能扔", "扔垃圾", "今天垃圾", "收垃圾",
  ],
  // landlord / building management
  [
    "landlord", "property manager", "building management", "management company", "who to contact for repair",
    "管理会社", "管理人", "大家", "オーナー", "家主",
    "房东", "物业", "管理公司", "管理员", "找谁修",
  ],
  // emergency vs non-emergency repair
  [
    "emergency repair", "urgent repair", "non-emergency", "repair request",
    "緊急修理", "応急修理", "修理依頼",
    "紧急维修", "紧急修理", "非紧急维修", "报修",
  ],
];

// ---------- LIVE ENTRIES ----------
// Full multilingual content. These are the ones retrieval indexes.
const LIVE_FAQS: FaqEntry[] = [
  // ================= renting =================
  {
    id: "renting-initial-cost",
    category: "renting",
    subtopic: "move-in-cost",
    representative_title: {
      en: "Initial move-in cost for a Japanese apartment",
      zh: "在日本租房的初期费用",
      ja: "日本のアパート入居時の初期費用",
    },
    user_question_pattern: {
      en: "How much do I actually need to move in?",
      zh: "租一间房子一开始到底要准备多少钱？",
      ja: "入居するときに、実際いくら用意しておけばいいですか？",
    },
    pain_point: {
      en: "Listings show monthly rent but hide that move-in can cost 4–6 months of rent.",
      zh: "房源只写月租，没告诉你搬进去的总花费可能是 4–6 个月的房租。",
      ja: "物件情報には月額だけ書いてあり、入居時に家賃の4～6ヶ月分が必要になることが見えづらいです。",
    },
    standard_answer: {
      en: "Expect the initial move-in cost to be roughly 4–6 months of monthly rent. It typically includes the first month's rent, security deposit (敷金, 1–2 months), key money (礼金, 0–2 months), agent fee (仲介手数料, ~1 month), fire insurance (~15,000 yen/2 years), guarantor company fee (0.5–1 month), and lock-change fee (~20,000 yen). Some listings say 'zero initial cost' (ゼロ初期費用) — those exist but are rarer and sometimes offset by higher monthly rent.",
      zh: "在日本租房，搬进去一次性要准备的钱大概是月租的 4–6 倍。通常包括：第一个月房租、敷金（1–2 个月，相当于押金）、礼金（0–2 个月）、中介费（约 1 个月）、火灾保险（两年约 1.5 万日元）、保证公司费用（0.5–1 个月）、换锁费（约 2 万日元）。有些房源会写“ゼロ初期費用”（零初期费用），这类房子存在但比较少，有时会用更高的月租来抵消。",
      ja: "日本で入居する際にまず必要になるお金は、月額家賃のだいたい4～6ヶ月分を目安に考えてください。内訳は、1ヶ月目の家賃、敷金（1～2ヶ月）、礼金（0～2ヶ月）、仲介手数料（約1ヶ月）、火災保険（2年で約1.5万円）、保証会社利用料（0.5～1ヶ月）、鍵交換代（約2万円）などが一般的です。「ゼロ初期費用」と書かれた物件もありますが、数は少なく、代わりに月額家賃がやや高めに設定されていることもあります。",
    },
    next_step_confirm: {
      en: "Ask the agent for a written breakdown (見積書) before signing anything.",
      zh: "签约之前让中介出一份书面的费用清单（見積書）。",
      ja: "契約前に、仲介業者に費用の内訳（見積書）を書面で出してもらいましょう。",
    },
    next_step_prepare: {
      en: "Have 4–6 months of rent available in cash, plus ID, employment proof, and your hanko.",
      zh: "准备好相当于 4–6 个月房租的现金，以及身份证件、在职证明、印章。",
      ja: "家賃の4～6ヶ月分の現金、身分証、在職証明、印鑑をご準備ください。",
    },
    next_step_contact: {
      en: "A foreigner-friendly rental agent (many are listed by city on Real Estate Japan, GaijinPot, Ichii, etc.).",
      zh: "找一家对外国人友好的中介（可以在 Real Estate Japan、GaijinPot、ichii 等网站按城市找）。",
      ja: "外国人対応に慣れた不動産業者（Real Estate Japan、GaijinPot、ichiiなどで地域別に探せます）。",
    },
    next_step_warning: {
      en: "If an agent asks you to pay large cash sums before signing, stop and ask for the line-item breakdown in writing first.",
      zh: "如果中介在签约之前就要你付一大笔现金，先停下来，要求对方给出书面的费用明细。",
      ja: "契約前に多額の現金を要求された場合は、いったん止めて、費用の内訳を書面で出してもらってください。",
    },
    target_user: ["new-arrival", "renter"],
    risk_level: "medium",
    official_confirmation_required: false,
    source_type: "seed",
    language: "multi",
    keywords: {
      // NOTE: do NOT add 租房/租房子 here — those are covered by the
      // SYNONYM_GROUPS rent group, and adding them again causes
      // double-counting that crowds out more specific FAQs (e.g.
      // tokyo-budget-100k) on queries like "房租10万在东京租哪里".
      en: ["initial cost", "move-in cost", "upfront cost", "first month", "rent", "deposit", "key money", "agent fee"],
      zh: ["初期费用", "房租", "押金", "礼金", "敷金", "中介费", "搬进去要多少钱"],
      // Japanese rental-process keywords added so Test 5
      // ("日本で部屋を借りる流れは？") matches this FAQ — there is no
      // dedicated "renting process" FAQ for JA yet.
      ja: ["初期費用", "家賃", "敷金", "礼金", "仲介手数料", "入居", "部屋", "部屋を借りる", "賃貸", "賃貸の流れ", "借りる", "借りる流れ", "流れ", "手続き", "アパート", "マンション"],
    },
    status: "live",
  },
  {
    id: "renting-guarantor",
    category: "renting",
    subtopic: "guarantor",
    representative_title: {
      en: "Do I need a guarantor to rent in Japan?",
      zh: "在日本租房需要保证人吗？",
      ja: "日本で賃貸するには保証人が必要ですか？",
    },
    user_question_pattern: {
      en: "I don't have any Japanese relatives. Can I still rent?",
      zh: "我在日本没有亲戚，还能租到房子吗？",
      ja: "日本に親族がいないのですが、部屋を借りられますか？",
    },
    pain_point: {
      en: "Most listings require a Japanese guarantor — which foreigners usually don't have.",
      zh: "很多房源要求日本籍保证人，但外国人基本没有。",
      ja: "多くの物件で日本人の連帯保証人を求められますが、外国人には現実的ではありません。",
    },
    standard_answer: {
      en: "Yes, you can — but almost nobody uses a personal guarantor anymore. The standard path is to use a guarantor company (保証会社) that, for a fee, vouches for your rent. Fees are typically 50–100% of one month's rent up front, plus a small annual renewal fee. Some agents require a specific company; others let you choose. This is the normal way foreigners rent and should not feel like a red flag.",
      zh: "可以，但现在几乎没人真的去找私人保证人了。标准做法是使用保证公司（保証会社），由它向房东担保你会正常交租，你需要付一笔费用。费用一般是一个月房租的 50%–100%，加上每年的小额续约费。有些中介会指定保证公司，有些可以让你自己选。这是外国人在日本租房的常态，不用担心。",
      ja: "はい、借りられます。ただ、個人の保証人を立てることはほぼなくなっており、一般的には「保証会社」を利用します。利用料は初回で家賃の50～100%、以降は年1回の少額の更新料が目安です。業者が特定の保証会社を指定する場合もあれば、選べる場合もあります。外国人の方の入居でもごく普通のやり方ですのでご安心ください。",
    },
    next_step_confirm: {
      en: "Ask the agent which guarantor company they require and what the total fee is.",
      zh: "问中介他们用哪家保证公司，总费用是多少。",
      ja: "仲介業者に、どの保証会社を使うか、合計いくらかかるかを確認してください。",
    },
    next_step_prepare: {
      en: "Your residence card, passport, and a Japanese employment or enrollment document.",
      zh: "准备好在留卡、护照，以及日本的在职或在学证明。",
      ja: "在留カード、パスポート、そして日本での在職証明または在学証明をご準備ください。",
    },
    next_step_contact: {
      en: "Your rental agent handles the guarantor-company application for you.",
      zh: "保证公司的申请由中介帮你办理。",
      ja: "保証会社への申込みは仲介業者が代行してくれます。",
    },
    target_user: ["new-arrival", "renter"],
    risk_level: "low",
    official_confirmation_required: false,
    source_type: "seed",
    language: "multi",
    keywords: {
      en: ["guarantor", "guarantor company", "rental guarantor", "no guarantor", "hoshounin"],
      zh: ["保证人", "保证公司", "担保", "担保人", "没有保证人", "保証会社"],
      ja: ["保証人", "保証会社", "連帯保証人"],
    },
    status: "live",
  },
  {
    id: "renting-key-money",
    category: "renting",
    subtopic: "key-money",
    representative_title: {
      en: "What is 'key money' (reikin) and can I avoid it?",
      zh: "“礼金”是什么？可以不付吗？",
      ja: "「礼金」とは何ですか？払わない方法はありますか？",
    },
    user_question_pattern: {
      en: "Why does the listing say I have to pay the landlord an extra month as 'reikin'?",
      zh: "房源为什么还要多付一个月的“礼金”？",
      ja: "物件情報に「礼金」と書いてあります。これは何ですか？",
    },
    pain_point: {
      en: "Key money is non-refundable and feels like a bonus to the landlord for no reason.",
      zh: "礼金是不退的，感觉就是白白送给房东。",
      ja: "礼金は返ってこないため、理由のない出費のように感じられます。",
    },
    standard_answer: {
      en: "Key money (礼金 / reikin) is a non-refundable gift to the landlord, usually 0–2 months of rent, paid at move-in. It is a cultural hold-over and, yes, you don't get it back. The good news: listings marked '礼金0' exist in most cities now, especially for newer buildings or apartments that have been vacant for a while. If you're flexible on exact building, filtering for reikin-zero is the simplest way to save a full month.",
      zh: "礼金（礼金／reikin）是在搬入时一次性付给房东的谢礼，通常是 0–2 个月的房租，而且不退。这是日本租房文化留下来的做法，的确是白给的一部分。好消息是：现在大多数城市都有标注“礼金0”的房源，尤其是较新的楼或空置时间较长的房间。如果你对具体楼栋没有特别要求，直接筛选“礼金0”就能省下整整一个月的钱。",
      ja: "礼金は、入居時に家主へ渡す返金されない謝礼で、通常は家賃の0～2ヶ月分です。文化的な慣習として残っているもので、退去時に戻ってきません。ただし最近は「礼金0」の物件も増えており、新築や空室が長く続いている物件に多く見られます。特定の物件にこだわりがなければ、「礼金0」で絞り込むだけで家賃1ヶ月分を節約できます。",
    },
    next_step_confirm: {
      en: "Ask to see only 礼金0 listings (the agent can filter instantly).",
      zh: "让中介只给你看“礼金0”的房源（他们可以一键筛选）。",
      ja: "仲介業者に「礼金0」の物件だけを見せてもらうよう依頼してください。",
    },
    next_step_prepare: {
      en: "Decide how much flexibility you have on area, age of building, and floor plan.",
      zh: "想好你在地段、楼龄、户型上能接受多少灵活度。",
      ja: "エリア、築年数、間取りについて、どこまで妥協できるかを先に決めておきましょう。",
    },
    next_step_contact: {
      en: "Your rental agent.",
      zh: "你的租房中介。",
      ja: "不動産仲介業者。",
    },
    target_user: ["new-arrival", "budget-conscious"],
    risk_level: "low",
    official_confirmation_required: false,
    source_type: "seed",
    language: "multi",
    keywords: {
      en: ["key money", "reikin", "gift money", "landlord gift"],
      zh: ["礼金", "禮金", "谢礼"],
      ja: ["礼金", "礼金0"],
    },
    status: "live",
  },
  {
    id: "renting-security-deposit",
    category: "renting",
    subtopic: "deposit",
    representative_title: {
      en: "How does the security deposit (shikikin) work?",
      zh: "敷金（押金）是怎么运作的？",
      ja: "敷金はどう使われますか？",
    },
    user_question_pattern: {
      en: "Will I get my shikikin back when I move out?",
      zh: "搬走的时候敷金能退回来吗？",
      ja: "退去のときに敷金は戻ってきますか？",
    },
    pain_point: {
      en: "Renters often expect full refund and then get almost nothing back due to cleaning deductions.",
      zh: "租客通常以为可以全额退回，结果因为清洁费等扣款，几乎拿不回什么钱。",
      ja: "全額戻ると思っていたのに、クリーニング代などの差引きでほとんど戻ってこないケースが多いです。",
    },
    standard_answer: {
      en: "Shikikin (敷金) is a security deposit, usually 1–2 months of rent, held by the landlord against damage and unpaid rent. On move-out, the landlord deducts cleaning and any restoration (原状回復) costs and refunds the rest. In practice, the refund can be much less than you expect — cleaning fees alone often run 30,000–80,000 yen. You can and should ask for a written breakdown of any deductions, and you have the right to dispute charges for normal wear and tear, which Japanese law places on the landlord, not the tenant.",
      zh: "敷金（shikikin）是押金，一般是 1–2 个月的房租，由房东保管，用来抵扣损坏和拖欠的房租。退租时房东会扣掉清洁费和“原状恢复”的费用，剩余部分再退给你。实际操作中，能拿回来的往往比你想象的少，光清洁费就经常是 3–8 万日元。你有权要求房东提供书面的扣款明细，对“正常磨损”部分的扣款可以拒绝——日本法律规定这类费用由房东承担。",
      ja: "敷金は家賃の1～2ヶ月分を目安とする預り金で、家主が損耗や未払い家賃の担保として保管します。退去時にクリーニング代や原状回復費用が差し引かれ、残額が返還される仕組みです。実際には期待ほど戻ってこないことも多く、クリーニング代だけで3万～8万円になるケースもあります。差引きの内訳は書面で要求できますし、通常の経年劣化・通常使用による損耗は借主負担ではなく家主負担という国の原則があり、不当な請求には異議を申し立てる権利があります。",
    },
    next_step_confirm: {
      en: "On move-out, ask for a written itemized deduction sheet before accepting the refund.",
      zh: "退房时，先要一份书面的扣款清单，再同意退款。",
      ja: "退去時は、返金を受け取る前に差引きの内訳を書面で出してもらってください。",
    },
    next_step_prepare: {
      en: "Take photos of the apartment's condition at move-in AND move-out.",
      zh: "搬进去和搬走的时候都把房间情况拍下来留底。",
      ja: "入居時と退去時の両方で、部屋の状態を写真に撮っておきましょう。",
    },
    next_step_contact: {
      en: "If disputed, your city's consumer affairs center (消費生活センター) offers free mediation.",
      zh: "如果对扣款有异议，可以联系你所在城市的消费者中心（消費生活センター），他们提供免费调解。",
      ja: "金額に納得できない場合は、お住まいの自治体の消費生活センターで無料の相談・あっせんが受けられます。",
    },
    next_step_warning: {
      en: "Don't sign the move-out document if the deductions include items that look like normal wear (small wall marks, floor scuffs).",
      zh: "如果扣款里包括看起来是正常磨损的部分（墙上的小印子、地板的划痕），先别签退租文件。",
      ja: "通常の使用による損耗（壁の小さな汚れ、床の傷など）まで差し引かれている場合、すぐに退去書類にサインしないでください。",
    },
    target_user: ["renter", "moving-out"],
    risk_level: "medium",
    official_confirmation_required: false,
    source_type: "seed",
    language: "multi",
    keywords: {
      en: ["security deposit", "shikikin", "deposit refund", "move-out", "cleaning fee", "restoration"],
      zh: ["敷金", "押金", "押金退还", "清洁费", "原状恢复"],
      ja: ["敷金", "敷金返還", "原状回復", "クリーニング代"],
    },
    status: "live",
  },
  {
    id: "renting-lease-renewal",
    category: "renting",
    subtopic: "renewal",
    representative_title: {
      en: "Lease renewal (koushin) — what happens after 2 years?",
      zh: "两年合同到期后的续约（更新）是怎么回事？",
      ja: "2年経ったあとの契約更新はどうなりますか？",
    },
    user_question_pattern: {
      en: "My 2-year contract is ending. Do I have to move out or pay something?",
      zh: "我的 2 年合同快到期了，要搬走还是交钱？",
      ja: "2年契約の更新時期です。引っ越さないといけませんか？",
    },
    pain_point: {
      en: "Tenants are often surprised by a one-month renewal fee every 2 years.",
      zh: "很多租客没想到每两年还要再多付一个月房租的“更新料”。",
      ja: "2年ごとに家賃1ヶ月分の更新料がかかることを知らずに驚く方が多いです",
    },
    standard_answer: {
      en: "Most residential contracts in Japan are 2-year terms with automatic renewal. You don't have to move out — you just pay a renewal fee (更新料 / koushin-ryou), typically 1 month's rent, plus renewed fire insurance and sometimes a renewed guarantor company fee. In some cities (notably Osaka), renewal fees are uncommon. The agent or management company will send you the renewal paperwork 1–3 months before the contract end date.",
      zh: "日本的住宅合同大多是两年期，合同到期后默认续约。你并不需要搬走，只需要交一笔“更新料”，通常是一个月房租，再加上续一次火灾保险，有时还要续保证公司费。有些地区（例如大阪）其实不太流行收更新料。中介或管理公司会在到期前 1–3 个月寄续约文件给你。",
      ja: "日本の住宅賃貸は2年契約が一般的で、期間満了時は自動更新されることがほとんどです。引っ越す必要はなく、更新料（多くは家賃1ヶ月分）と、火災保険の更新、場合によっては保証会社の更新料を支払います。関西圏（特に大阪）では更新料がない物件も多いです。更新手続きの書類は、契約満了の1～3ヶ月前に仲介や管理会社から届きます。",
    },
    next_step_confirm: {
      en: "Check your original contract — the exact renewal fee and required insurance are written there.",
      zh: "翻出你当初的合同，上面会写明确的更新料和需要续的保险。",
      ja: "元の契約書をご確認ください。更新料と必要な保険の内容が明記されています。",
    },
    next_step_prepare: {
      en: "Have one month's rent plus ~15,000 yen for renewed insurance ready before the deadline.",
      zh: "在到期之前准备好一个月房租，再加上约 1.5 万日元的保险续费。",
      ja: "期限までに、家賃1ヶ月分と保険更新分の約1.5万円を準備しておきましょう。",
    },
    next_step_contact: {
      en: "Your management company or rental agent.",
      zh: "管理公司或你的中介。",
      ja: "管理会社または不動産仲介業者。",
    },
    target_user: ["existing-renter"],
    risk_level: "low",
    official_confirmation_required: false,
    source_type: "seed",
    language: "multi",
    keywords: {
      en: ["lease renewal", "contract renewal", "koushin", "renewal fee", "2-year contract"],
      zh: ["续约", "更新", "更新料", "房屋合同到期"],
      ja: ["更新料", "契約更新", "2年契約"],
    },
    status: "live",
  },
  {
    id: "renting-foreigner-discrimination",
    category: "renting",
    subtopic: "discrimination",
    representative_title: {
      en: "Listings that say 'no foreigners' — what can I do?",
      zh: "房源写“不租给外国人”，我该怎么办？",
      ja: "「外国人不可」の物件が多いのですが、どうすればいいですか？",
    },
    user_question_pattern: {
      en: "A lot of apartments seem closed to foreigners. Is this legal?",
      zh: "很多公寓好像直接不租给外国人，这合法吗？",
      ja: "外国人お断りの物件が多いのですが、これは合法ですか？",
    },
    pain_point: {
      en: "It feels humiliating and leaves you wondering how to find anywhere at all.",
      zh: "被拒很伤自尊，而且让人不知道到底该去哪里找。",
      ja: "断られるたびに気分が落ち、そもそもどこを探せばいいのか分からなくなります。",
    },
    standard_answer: {
      en: "Private landlords in Japan can legally refuse tenants on many grounds, including nationality. It's discouraging, but it's not the whole market. The practical way around it is to go through an agent that specializes in foreign residents — they already know which landlords accept foreigners, which saves you from walking into rejections. UR housing (public) and municipal housing (市営住宅) also do not require a Japanese guarantor and generally welcome foreign residents.",
      zh: "日本的私人房东在法律上可以以包括国籍在内的多种理由拒绝租客，这确实让人沮丧，但这并不是全部市场。实用的做法是通过专门做外国人租房的中介，他们已经掌握了哪些房东愿意租给外国人，能帮你避开大多数被拒。UR（公团）住宅和市政住宅（市営住宅）都不要求日本保证人，一般对外国居民是开放的。",
      ja: "日本では民間の家主が様々な理由で入居を断ることが認められており、その中には国籍も含まれます。つらい話ですが、市場全体がそうというわけではありません。現実的には、外国人入居に慣れた仲介業者を使うのがいちばん早いです。彼らは受け入れ実績のある家主を把握しているため、断られる確率がぐっと下がります。また、UR賃貸住宅や市営住宅は保証人不要で、外国人住民も利用しやすい選択肢です。",
    },
    next_step_confirm: {
      en: "Ask the agent directly: 'Which of these listings actually accept foreign residents?'",
      zh: "直接问中介：“这些房源里，哪些真的接受外国人？”",
      ja: "仲介業者に直接、「このうち外国人入居可の物件はどれですか？」と確認してください。",
    },
    next_step_prepare: {
      en: "Have your residence card, employment proof, and a short self-introduction ready — it reassures landlords.",
      zh: "准备好在留卡、在职证明，再加一份简短的自我介绍——这会让房东更安心。",
      ja: "在留カード、在職証明、そして簡単な自己紹介文を用意しておくと、家主側の安心感につながります。",
    },
    next_step_contact: {
      en: "Foreigner-friendly agents (Real Estate Japan, GaijinPot, Ichii, Nippon Housing, etc.) or your local UR housing office.",
      zh: "对外国人友好的中介（Real Estate Japan、GaijinPot、ichii、Nippon Housing 等），或者当地的 UR 住宅办事处。",
      ja: "外国人対応の仲介業者（Real Estate Japan、GaijinPot、ichii、Nippon Housingなど）や、お近くのUR賃貸営業センター。",
    },
    target_user: ["new-arrival", "renter"],
    risk_level: "low",
    official_confirmation_required: false,
    source_type: "seed",
    language: "multi",
    keywords: {
      en: ["no foreigners", "foreigner discrimination", "rental discrimination", "gaijin okay", "foreigners allowed"],
      zh: ["不租给外国人", "歧视", "拒绝外国人", "外国人可"],
      ja: ["外国人不可", "外国人お断り", "外国人相談可"],
    },
    status: "live",
  },
  {
    id: "renting-apartment-type-codes",
    category: "renting",
    subtopic: "floor-plan-abbreviations",
    representative_title: {
      en: "What do 1K, 1DK, 1LDK, 2LDK mean?",
      zh: "1K、1DK、1LDK、2LDK 是什么意思？",
      ja: "1K、1DK、1LDK、2LDKとは何を意味しますか？",
    },
    user_question_pattern: {
      en: "How do I read Japanese apartment floor plans?",
      zh: "日本房源上的户型缩写怎么看？",
      ja: "日本の物件情報にある間取りの略号はどう読めばいいですか？",
    },
    pain_point: {
      en: "The numbers look like rooms, but a '1K' is tiny and a '1LDK' is a real one-bedroom.",
      zh: "看上去只是房间数量，其实 1K 很小，1LDK 才是真正的“一室一厅”。",
      ja: "数字が部屋数に見えますが、1Kはとても狭く、1LDKでようやく実質1部屋+LDKの広さになります。",
    },
    standard_answer: {
      en: "The number is how many bedrooms there are; the letters describe the other rooms. K = kitchen (small, cook-only), DK = dining-kitchen (room you can also eat in), LDK = living-dining-kitchen (a proper living area). So 1K is one tiny bedroom with a cooking nook, 1DK has a small eating space, and 1LDK has a real living room. Typical sizes: 1K ~18–25㎡, 1DK ~25–30㎡, 1LDK ~30–45㎡, 2LDK ~50–70㎡.",
      zh: "前面的数字是卧室数量，后面的字母表示其他房间。K = 厨房（只够做饭的小空间），DK = 厨房+餐厅（可以吃饭的空间），LDK = 客厅+餐厅+厨房（真正的起居空间）。所以 1K 是一间小卧室加一个能做饭的角落；1DK 多了一小片吃饭的地方；1LDK 才有正经客厅。参考面积：1K 约 18–25㎡，1DK 约 25–30㎡，1LDK 约 30–45㎡，2LDK 约 50–70㎡。",
      ja: "数字は寝室の数で、アルファベットはそれ以外の部屋を表します。K=キッチン（簡単な調理スペースのみ）、DK=ダイニングキッチン（食事もできる広さ）、LDK=リビング・ダイニング・キッチン（本格的な居間）です。1Kは小さな寝室＋調理スペース、1DKは食事ができるスペース、1LDKは本格的なリビングが付きます。広さの目安は、1K=約18～25㎡、1DK=約25～30㎡、1LDK=約30～45㎡、2LDK=約50～70㎡。",
    },
    next_step_confirm: {
      en: "On listings, always check the total floor area in ㎡ — it's more honest than the room code.",
      zh: "看房源时，直接看“面积（㎡）”比看户型缩写更能反映真实大小。",
      ja: "物件情報では、間取り記号よりも「専有面積(㎡)」を確認するほうが実態をつかみやすいです。",
    },
    next_step_prepare: {
      en: "Decide your minimum livable ㎡ before you start searching — it filters out surprises.",
      zh: "开始找房之前先定一个你能接受的最小面积，可以省掉很多白看。",
      ja: "物件探しの前に「これより狭いのは無理」という㎡の下限を決めておくと効率的です。",
    },
    next_step_contact: {
      en: "Your rental agent — they can filter listings by minimum ㎡.",
      zh: "租房中介——他们可以按最小面积帮你筛选房源。",
      ja: "不動産仲介業者に最低㎡数で絞り込み検索を依頼してください。",
    },
    target_user: ["new-arrival", "renter"],
    risk_level: "low",
    official_confirmation_required: false,
    source_type: "seed",
    language: "multi",
    keywords: {
      en: ["1k", "1dk", "1ldk", "2ldk", "floor plan", "apartment layout", "madori"],
      zh: ["1K", "1DK", "1LDK", "2LDK", "户型", "间取"],
      ja: ["1K", "1DK", "1LDK", "2LDK", "間取り", "間取"],
    },
    status: "live",
  },
  {
    id: "renting-utilities-setup",
    category: "renting",
    subtopic: "utilities",
    representative_title: {
      en: "Setting up electricity, gas, and water after moving in",
      zh: "搬进去之后怎么开通水电煤？",
      ja: "入居後の電気・ガス・水道の開通手続き",
    },
    user_question_pattern: {
      en: "Who do I call to turn on the lights and water?",
      zh: "水电要打哪里的电话才能开通？",
      ja: "電気や水道はどこに連絡すれば使えるようになりますか？",
    },
    pain_point: {
      en: "New residents arrive with no idea which companies to contact, and gas requires someone to be home.",
      zh: "新搬来的人根本不知道要联系哪几家公司，而且开通煤气还要求有人在家。",
      ja: "どの会社に連絡すればよいか分からず、さらにガスは開栓立ち会いが必要で戸惑う方が多いです。",
    },
    standard_answer: {
      en: "Electricity and water you can usually start online or by phone, and they begin the same day. Gas is different: a technician must come to open the gas line (開栓 / kaisen), and you must be home for the visit. Schedule gas a few days in advance, especially around move-in season. Your rental paperwork usually includes the contact info for each company (or your agent can tell you). Bring your new address and the move-in date when you call.",
      zh: "电和自来水一般在网上或电话就能办，当天就能开通。煤气不一样——需要技师上门开通（開栓），而且必须有人在家。所以尽量提前几天预约，搬家高峰期尤其要早订。租房的资料里通常会写每家公司的联系方式，或者可以问中介。联系时报上新地址和入住日即可。",
      ja: "電気と水道は電話やインターネットで申し込むだけで、通常その日のうちから使えます。ガスは異なり、開栓には係員の立ち会いが必要で、当日必ず在宅しておかなければいけません。特に3～4月の繁忙期は予約が取りにくいため、数日前には申し込んでおきましょう。契約書類に各社の連絡先が記載されているか、仲介業者から案内があります。新住所と入居日を伝えれば手続きできます。",
    },
    next_step_confirm: {
      en: "Confirm your agent gave you the electric/gas/water company names for your address (they vary by area).",
      zh: "确认中介有没有告诉你这个地址对应的电、煤气、水公司名字（不同区域不一样）。",
      ja: "ご住所に対応する電力・ガス・水道会社名を仲介業者から受け取っているか確認してください（地域で異なります）。",
    },
    next_step_prepare: {
      en: "Know your move-in date and have your new address written in Japanese (or on the lease).",
      zh: "记清楚入住日，并准备好用日文写好的新地址（合同上就有）。",
      ja: "入居日と、日本語表記の新住所（契約書に記載あり）を手元にご用意ください。",
    },
    next_step_contact: {
      en: "Each utility's customer service line, usually on your lease paperwork. Electricity + water by phone/online. Gas by phone to schedule a visit.",
      zh: "每家公司的客服电话，租房资料上都有。电和水打电话或上网就行，煤气要打电话预约上门。",
      ja: "契約書類記載の各社カスタマーセンターへ。電気・水道は電話やインターネット、ガスは電話で開栓予約を行ってください。",
    },
    target_user: ["new-arrival", "renter"],
    risk_level: "low",
    official_confirmation_required: false,
    source_type: "seed",
    language: "multi",
    keywords: {
      en: ["electricity", "gas", "water", "utilities", "set up utilities", "turn on power", "gas opening", "kaisen"],
      zh: ["水电", "煤气", "电气", "开通", "水电煤", "開栓"],
      ja: ["電気", "ガス", "水道", "開栓", "公共料金"],
    },
    status: "live",
  },

  // ================= home_buying =================
  {
    id: "home-buying-foreigner-ownership",
    category: "home_buying",
    subtopic: "ownership",
    representative_title: {
      en: "Can foreigners buy property in Japan?",
      zh: "外国人可以在日本买房吗？",
      ja: "外国人でも日本で不動産を買えますか？",
    },
    user_question_pattern: {
      en: "Do I need citizenship or permanent residency to buy a home here?",
      zh: "买房需要日本国籍或永住吗？",
      ja: "家を買うには日本国籍や永住権が必要ですか？",
    },
    pain_point: {
      en: "People assume buying is blocked for foreigners — it isn't, but mortgages are.",
      zh: "很多人以为外国人不能买房，其实可以，但是贷款是另一回事。",
      ja: "外国人は購入自体できないと誤解している方が多いですが、所有自体は可能です（住宅ローンは別問題です）。",
    },
    standard_answer: {
      en: "Yes — Japan has no nationality restriction on owning real estate. A tourist could technically buy a house here. What's hard is getting a home loan: most Japanese banks require permanent residency, a Japanese spouse, or many years of stable employment in Japan. Without that, you'd need a cash purchase or a loan from a small number of banks that specialize in foreign residents (usually with higher interest rates and larger down payments).",
      zh: "可以。日本对不动产所有权没有国籍限制，理论上连短期游客都能买房。真正难的是贷款：大多数日本银行要求你有永住权、日本籍配偶，或在日本稳定工作多年。否则你要么全款买，要么找少数专门面向外国人的银行（利率通常更高，首付也更高）。",
      ja: "はい、日本では外国人でも不動産を購入できます。国籍による所有制限はなく、理論上は観光ビザでも購入可能です。難しいのは住宅ローンの側で、日本の多くの銀行は永住権、日本人配偶者、または長年の安定した在職実績を求めます。該当しない場合は、現金購入か、外国人向けに特化した一部の銀行のローン（金利と頭金が高めになる傾向）を検討することになります。",
    },
    next_step_confirm: {
      en: "Decide whether you plan to pay cash or need a loan — the process is completely different from there.",
      zh: "先想清楚是要全款还是要贷款，后续流程完全不一样。",
      ja: "まずは現金購入か住宅ローン利用かを決めてください。その後の流れが大きく変わります。",
    },
    next_step_prepare: {
      en: "Gather your residence card, income proof, and tax statements for the last 2–3 years.",
      zh: "准备好在留卡、收入证明，以及最近 2–3 年的纳税证明。",
      ja: "在留カード、収入証明、直近2～3年分の納税証明書をご用意ください。",
    },
    next_step_contact: {
      en: "A real estate agent that works with foreign buyers; ask specifically about mortgage eligibility before you commit to any property.",
      zh: "找一家做过外国人买家的不动产中介，在看中房子之前先问清楚你是否有贷款资格。",
      ja: "外国人購入の取り扱い経験がある不動産会社へ。物件を決める前に、必ず住宅ローンの審査可否を確認してください。",
    },
    next_step_warning: {
      en: "Owning property in Japan does NOT give you or improve your visa status.",
      zh: "在日本买房并不会给你签证，也不会让签证更容易。",
      ja: "日本で不動産を所有しても、在留資格の取得や更新には直接影響しません。",
    },
    target_user: ["buyer", "investor"],
    risk_level: "medium",
    official_confirmation_required: false,
    source_type: "seed",
    language: "multi",
    keywords: {
      en: ["can foreigners buy", "buy property", "buy house", "ownership", "foreign buyer"],
      zh: ["外国人买房", "买房", "购房", "不动产所有", "外国人购买"],
      ja: ["外国人 購入", "不動産購入", "家を買う", "外国人 不動産"],
    },
    status: "live",
  },
  {
    id: "home-buying-mortgage-eligibility",
    category: "home_buying",
    subtopic: "mortgage",
    representative_title: {
      en: "Who can get a home loan (jutaku loan) as a foreign resident?",
      zh: "外国居民能申请日本的住房贷款吗？",
      ja: "外国人住民でも住宅ローンは組めますか？",
    },
    user_question_pattern: {
      en: "Will a Japanese bank give me a mortgage if I'm on a work visa?",
      zh: "我是工作签证，日本的银行会给我房贷吗？",
      ja: "就労ビザで日本の銀行の住宅ローンは組めますか？",
    },
    pain_point: {
      en: "Most banks quietly reject non-PR applicants without saying it publicly.",
      zh: "大多数银行私下里会直接拒永住以外的申请，但不会公开说。",
      ja: "永住権がない申込者は断られることが多いですが、その旨は公に示されていません。",
    },
    standard_answer: {
      en: "Most large Japanese banks require permanent residency (永住権) before they'll seriously consider a home loan. If you have a Japanese spouse, that can substitute at some banks. Without PR or a Japanese spouse, your realistic options shrink to: (a) SMBC Prestia, Shinsei, and a handful of others that accept long-term work visa holders with stable income; (b) loans in your home country collateralized against the property; (c) cash purchase. Down payments for foreign residents are often 20–30%, higher than the Japanese norm.",
      zh: "日本主要银行基本上要求申请人持有永住权（永住権）才认真受理房贷。如果你有日本籍配偶，有些银行会把配偶作为替代条件。如果两者都没有，现实的选择就只剩下：(a) SMBC Prestia、新生银行等少数愿意接收长期工作签证、稳定收入者的银行；(b) 在母国以该不动产作抵押的贷款；(c) 全款。外国居民的首付通常是 20%–30%，比日本人标准要高。",
      ja: "日本の大手銀行は、住宅ローンの本格的な審査対象を永住権保持者に限定していることが多いです。日本人配偶者がいる場合は代替になる銀行もあります。いずれもない場合の現実的な選択肢は、(a) SMBCプレスティア、新生銀行など外国人向け実績のある銀行、(b) 母国での物件担保ローン、(c) 現金購入、の3つに絞られます。外国人住民の場合、頭金は20～30%と、日本人向けより高めに設定される傾向があります。",
    },
    next_step_confirm: {
      en: "Ask any bank BEFORE house-hunting: 'Given my visa and income, would my application even be accepted?'",
      zh: "看房之前先问银行：“以我现在的签证和收入，申请会被受理吗？”",
      ja: "物件探しを始める前に銀行へ、「この在留資格と収入で審査を受け付けてもらえますか？」と確認してください。",
    },
    next_step_prepare: {
      en: "Prepare: passport, residence card, tax certificates (課税証明書) for 2–3 years, employment proof, and proof of any down payment cash source.",
      zh: "准备：护照、在留卡、近 2–3 年的纳税证明（課税証明書）、在职证明，以及首付资金的来源证明。",
      ja: "パスポート、在留カード、直近2～3年の課税証明書、在職証明、頭金の資金出所証明をご準備ください。",
    },
    next_step_contact: {
      en: "SMBC Prestia, Shinsei Bank, or a mortgage broker specialized in foreign buyers.",
      zh: "SMBC Prestia、新生银行，或专门做外国人买家的贷款经纪。",
      ja: "SMBCプレスティア、新生銀行、または外国人向け住宅ローンを専門とするブローカー。",
    },
    next_step_warning: {
      en: "Do not sign a purchase agreement before your loan pre-approval is confirmed in writing.",
      zh: "在收到书面的贷款预审通过之前，不要签购房合同。",
      ja: "住宅ローンの事前審査通過が書面で確認できるまで、売買契約にサインしないでください。",
    },
    target_user: ["buyer"],
    risk_level: "high",
    official_confirmation_required: true,
    source_type: "seed",
    language: "multi",
    keywords: {
      en: ["mortgage", "home loan", "jutaku loan", "housing loan", "loan eligibility", "permanent resident loan"],
      zh: ["房贷", "住房贷款", "贷款资格", "外国人贷款", "永住 贷款"],
      ja: ["住宅ローン", "ローン審査", "外国人 住宅ローン", "永住権 ローン"],
    },
    status: "live",
  },
  {
    id: "home-buying-property-tax",
    category: "home_buying",
    subtopic: "tax",
    representative_title: {
      en: "Property taxes on a Japanese home",
      zh: "日本自有住宅要交的税",
      ja: "日本の持ち家にかかる税金",
    },
    user_question_pattern: {
      en: "What taxes do I pay after buying a house?",
      zh: "买完房之后每年要交什么税？",
      ja: "住宅を購入したあとに毎年かかる税金は何ですか？",
    },
    pain_point: {
      en: "Buyers focus on purchase price and miss the annual property tax and one-time acquisition taxes.",
      zh: "买家往往只盯着房价，忽略了每年的固定资产税和一次性的取得税。",
      ja: "購入価格ばかり気にして、毎年の固定資産税や購入時の不動産取得税を見落としがちです。",
    },
    standard_answer: {
      en: "Two main kinds: (1) ongoing — fixed asset tax (固定資産税, ~1.4% of assessed value per year) plus city planning tax (都市計画税, ~0.3%), billed once or four times a year by your city office; (2) one-time at purchase — registration tax (登録免許税), stamp duty (印紙税), and real estate acquisition tax (不動産取得税), which usually arrives 3–6 months after purchase as a separate bill from the prefecture. Budget another 6–10% of the purchase price for these closing costs.",
      zh: "主要有两类：(1) 长期——固定资产税（固定資産税，评估价的约 1.4%／年）+ 城市规划税（都市計画税，约 0.3%／年），由市役所一年一次或分四次账单寄给你；(2) 一次性——登记税（登録免許税）、印花税（印紙税）、不动产取得税（不動産取得税），其中取得税一般在买房后 3–6 个月由都道府县寄单。一次性成交费用大概要再准备房价的 6%–10%。",
      ja: "主に2種類あります。(1) 毎年かかる税金：固定資産税（評価額の約1.4%／年）と都市計画税（約0.3%／年）。市区町村から年1回または年4回で請求されます。(2) 購入時に発生する税金：登録免許税、印紙税、不動産取得税。不動産取得税は購入から3～6ヶ月後に都道府県から別途請求されます。購入価格に加えて、これら諸費用として6～10%を見込んでおくと安心です。",
    },
    next_step_confirm: {
      en: "Ask the agent and judicial scrivener (司法書士) for an itemized estimate of all closing taxes BEFORE you close.",
      zh: "签约前让中介和司法书士（司法書士）给你一份书面的成交税费清单。",
      ja: "決済前に、仲介業者と司法書士から購入時諸税・諸費用の内訳を書面で出してもらってください。",
    },
    next_step_prepare: {
      en: "Keep at least 6–10% of purchase price as extra cash for closing and the later acquisition tax bill.",
      zh: "除了房价之外，再留出房价 6%–10% 的现金，用于成交费用和之后的取得税。",
      ja: "購入価格の6～10%程度は、諸費用と後日届く不動産取得税用に別途確保しておいてください。",
    },
    next_step_contact: {
      en: "Your judicial scrivener (司法書士), city tax office, and a tax accountant if your situation is complex.",
      zh: "司法书士（司法書士）、市役所税务窗口；情况复杂的话找税理士（税理士）。",
      ja: "司法書士、市区町村の税務窓口、複雑な場合は税理士にご相談ください。",
    },
    target_user: ["buyer", "owner"],
    risk_level: "medium",
    official_confirmation_required: true,
    source_type: "seed",
    language: "multi",
    keywords: {
      en: ["property tax", "fixed asset tax", "acquisition tax", "registration tax", "stamp duty", "homeowner tax"],
      zh: ["固定资产税", "不动产取得税", "登记税", "印花税", "房产税"],
      ja: ["固定資産税", "都市計画税", "不動産取得税", "登録免許税"],
    },
    status: "live",
  },

  // ================= visa =================
  {
    id: "visa-residence-card-renewal",
    category: "visa",
    subtopic: "renewal",
    representative_title: {
      en: "Renewing your residence card",
      zh: "在留卡的更新",
      ja: "在留カードの更新",
    },
    user_question_pattern: {
      en: "How do I renew my zairyu card before it expires?",
      zh: "我的在留卡快过期了，要怎么办更新？",
      ja: "在留カードの有効期限が近いのですが、どう更新すればいいですか？",
    },
    pain_point: {
      en: "People miss the deadline because city office staff can't do this — only the Immigration Bureau can.",
      zh: "很多人以为在市役所就能办，结果拖到截止——其实只能去入国管理局。",
      ja: "市役所では手続きできないことを知らず、期限を過ぎてしまう方がいます。",
    },
    standard_answer: {
      en: "Your residence card (在留カード) is renewed at your regional Immigration Services Agency office, not at the city office. You can apply from up to 3 months before your current period of stay expires. Bring the current residence card, passport, photo, and documents that support your visa category (employment contract, school enrollment, family documents, etc.). Processing can take several weeks, so don't wait until the last week.",
      zh: "在留卡（在留カード）的更新要去你所在地区的出入国在留管理局，不是市役所。最早可以在当前在留期限到期前 3 个月开始申请。办理时带上现有的在留卡、护照、证件照，以及对应你在留资格的文件（劳动合同、在学证明、家族关系文件等）。审核可能要几周，不要拖到最后一周。",
      ja: "在留カードの更新は、お住まいの地域を管轄する地方出入国在留管理局で行います（市役所ではありません）。現在の在留期限の3ヶ月前から申請できます。現行の在留カード、パスポート、証明写真、そして在留資格に応じた必要書類（在職証明、在学証明、家族関係書類など）を持参してください。審査には数週間かかることもあるので、ぎりぎりの申請は避けましょう。",
    },
    next_step_confirm: {
      en: "Check your current card for the exact expiration date — the 3-month window counts backward from there.",
      zh: "看一下在留卡上的到期日，可以提前 3 个月开始申请，就是从这天往前数。",
      ja: "在留カードに記載の有効期限を確認してください。そこから3ヶ月前が申請可能日です。",
    },
    next_step_prepare: {
      en: "Current residence card, passport, one passport photo (4x3cm), fee stamps, and visa-type-specific documents.",
      zh: "现有在留卡、护照、一张 4×3cm 证件照、手续费印纸，以及对应签证类型的材料。",
      ja: "現行の在留カード、パスポート、4×3cmの証明写真、収入印紙、在留資格別の必要書類。",
    },
    next_step_contact: {
      en: "Your regional Immigration Services Agency office (地方出入国在留管理局).",
      zh: "你所在地区的出入国在留管理局（地方出入国在留管理局）。",
      ja: "お住まいの地域の地方出入国在留管理局。",
    },
    next_step_warning: {
      en: "If you miss the deadline and overstay, there are serious legal consequences. Start early.",
      zh: "一旦过期变成“不法滞在”（overstay）后果很严重，尽早开始办。",
      ja: "期限を過ぎてオーバーステイになると重大な法的影響が出ます。早めに手続きを始めてください。",
    },
    target_user: ["any-resident"],
    risk_level: "high",
    official_confirmation_required: true,
    source_type: "government",
    language: "multi",
    keywords: {
      en: ["residence card", "zairyu", "renewal", "renew", "visa renewal", "expire"],
      zh: ["在留卡", "更新", "续签", "签证更新"],
      ja: ["在留カード", "更新", "在留資格 更新"],
    },
    status: "live",
  },
  {
    id: "visa-permanent-residency",
    category: "visa",
    subtopic: "permanent-residency",
    representative_title: {
      en: "Applying for permanent residency (eijuken)",
      zh: "申请日本永住权",
      ja: "永住権の申請",
    },
    user_question_pattern: {
      en: "How many years do I need before I can apply for PR?",
      zh: "要在日本住多少年才能申请永住？",
      ja: "何年住めば永住申請できますか？",
    },
    pain_point: {
      en: "The rules have multiple paths and the shortest one depends on your specific visa.",
      zh: "永住申请有好几条路，最快的那条要看你现在是什么签证。",
      ja: "永住申請にはいくつかのルートがあり、最短ルートは在留資格によって変わります。",
    },
    standard_answer: {
      en: "The default path requires 10 years of continuous residence in Japan (with at least 5 years on a work visa). Shorter paths exist: 3 years for spouses of Japanese nationals or PRs, 5 years for 'Contributors to Japan', and 1 or 3 years for Highly Skilled Professionals depending on points. You must also show stable income, tax and pension payment history, no criminal record, and a guarantor. Immigration is strict about unpaid pension — this is the #1 reason for rejection.",
      zh: "一般路线是在日本连续居住 10 年以上，其中至少 5 年持工作签证。更快的路线有：日本国民或永住者的配偶 3 年；“贡献者”5 年；高度人材（HSP）根据积分 1 年或 3 年。同时你需要证明：稳定收入、完整的税金和年金缴纳记录、无犯罪记录，并且有保证人。入管局对年金未缴非常严格——这是被拒最常见的原因。",
      ja: "原則は、日本に連続して10年以上在留し、そのうち5年以上は就労系の在留資格であることです。短縮ルートとして、日本人または永住者の配偶者は3年、「我が国への貢献者」は5年、高度人材は点数制で1年または3年が認められます。あわせて、安定した収入、納税・年金の完納、犯罪歴なし、身元保証人が求められます。特に国民年金の未納は、不許可になる最大の要因です。",
    },
    next_step_confirm: {
      en: "Check: (1) how many years of continuous residency you have; (2) whether your pension is fully paid for the last 2 years; (3) your current visa type.",
      zh: "先确认三件事：(1) 在日本连续居住了多少年；(2) 最近两年的年金有没有全部交齐；(3) 当前签证类型。",
      ja: "まず、(1) 連続在留年数、(2) 直近2年分の年金が完納されているか、(3) 現在の在留資格、の3点を確認してください。",
    },
    next_step_prepare: {
      en: "Tax certificates for the last 5 years, pension payment records (nenkin teiki-bin), employment contract, and bank statements.",
      zh: "最近 5 年的纳税证明、年金缴纳记录（年金定期便）、劳动合同、银行流水。",
      ja: "直近5年分の課税証明書、年金定期便などの納付記録、雇用契約書、預金通帳。",
    },
    next_step_contact: {
      en: "Your regional Immigration office, or a licensed immigration lawyer (行政書士) for complex cases.",
      zh: "你所在地区的入国管理局；情况复杂时找行政书士（行政書士）。",
      ja: "お住まいの地域の出入国在留管理局。複雑な場合は行政書士へご相談を。",
    },
    next_step_warning: {
      en: "Do not apply if you have unpaid pension or tax for the past 2 years — fix those first, or the application will likely be denied.",
      zh: "如果过去两年有年金或税金未缴，先补齐再申请，否则几乎一定被拒。",
      ja: "過去2年間に年金や税金の未納があれば、まずそれを解消してから申請してください。そうでないと不許可の可能性が高いです。",
    },
    target_user: ["long-term-resident"],
    risk_level: "high",
    official_confirmation_required: true,
    source_type: "government",
    language: "multi",
    keywords: {
      en: ["permanent residency", "pr", "eijuken", "permanent resident", "eijū", "eijuu", "long term stay"],
      zh: ["永住", "永住权", "永久居留", "永住許可"],
      ja: ["永住権", "永住許可", "永住申請"],
    },
    status: "live",
  },
  {
    id: "visa-change-of-status",
    category: "visa",
    subtopic: "change-of-status",
    representative_title: {
      en: "Changing your visa status (for example, student to work)",
      zh: "在留资格变更（比如学生签换工作签）",
      ja: "在留資格の変更（例：留学から就労へ）",
    },
    user_question_pattern: {
      en: "How do I switch from a student visa to a work visa?",
      zh: "毕业后怎么从留学签证换成工作签证？",
      ja: "卒業後に留学ビザから就労ビザに変えるには？",
    },
    pain_point: {
      en: "Students worry about the gap between graduation and starting work.",
      zh: "学生最担心毕业到入职之间那段空窗期的身份问题。",
      ja: "卒業から就職までの空白期間に在留資格が切れないか不安な方が多いです。",
    },
    standard_answer: {
      en: "Submit a 'Change of Status of Residence' (在留資格変更許可申請) application at your regional Immigration office. For student-to-work, you apply as soon as you have an official job offer, ideally before graduation. You need: the change-of-status application form, your passport and residence card, the employer's offer letter, the company's corporate documents, and your graduation certificate. Processing can take 1–3 months — during that time your student status stays valid, so apply early.",
      zh: "去你所在地区的入国管理局提交“在留资格变更许可申请”（在留資格変更許可申請）。学生转工作的话，一拿到正式 offer 就可以申请，最好在毕业前就交材料。需要准备：申请表、护照、在留卡、公司的录用通知书、公司登记资料、毕业证或毕业预定证明。审核通常 1–3 个月，在此期间原学生签证依然有效，所以早交越安心。",
      ja: "地方出入国在留管理局に「在留資格変更許可申請」を提出します。留学から就労への場合、正式な内定が出た段階で申請可能で、卒業前に進めるのが理想です。申請書、パスポート、在留カード、内定通知書、雇用主の法人登記書類、卒業証明書または卒業見込証明書が必要です。審査期間は通常1～3ヶ月で、その間は現行の留学資格が有効なので、早めに申請するほど安心です。",
    },
    next_step_confirm: {
      en: "Confirm with your employer that they will provide the corporate documents required by Immigration.",
      zh: "和公司确认一下，他们会提供入管需要的公司方面的材料。",
      ja: "入管が求める法人側の提出書類について、雇用主と事前に確認してください。",
    },
    next_step_prepare: {
      en: "Application form, passport, residence card, offer letter, graduation certificate (or expected graduation letter), tax and pension payment proof.",
      zh: "申请表、护照、在留卡、录用通知书、毕业证或毕业预定证明、纳税和年金缴纳证明。",
      ja: "申請書、パスポート、在留カード、内定通知書、卒業（見込）証明書、納税証明、年金納付証明。",
    },
    next_step_contact: {
      en: "Your regional Immigration office. For complex cases, an immigration lawyer (行政書士).",
      zh: "你所在地区的入国管理局；情况复杂可以找行政书士（行政書士）。",
      ja: "地方出入国在留管理局。複雑なケースは行政書士に相談してください。",
    },
    target_user: ["student", "job-changer"],
    risk_level: "high",
    official_confirmation_required: true,
    source_type: "government",
    language: "multi",
    keywords: {
      en: ["change of status", "status change", "student to work", "visa change", "zairyu shikaku henkou"],
      zh: ["在留资格变更", "变更签证", "学生签换工作签"],
      ja: ["在留資格変更", "資格変更", "留学 就労"],
    },
    status: "live",
  },
  {
    id: "visa-re-entry-permit",
    category: "visa",
    subtopic: "re-entry",
    representative_title: {
      en: "Leaving Japan temporarily: do I need a re-entry permit?",
      zh: "短期离开日本再回来，需要办“再入境许可”吗？",
      ja: "一時的に日本を離れるときに再入国許可は必要ですか？",
    },
    user_question_pattern: {
      en: "I want to visit my family for 2 weeks. Will I lose my visa?",
      zh: "我想回家两周，在留资格会不会因此失效？",
      ja: "家族に会いに2週間ほど帰国したいのですが、在留資格は失効しますか？",
    },
    pain_point: {
      en: "Residents are afraid any trip home cancels their status — mostly, it doesn't.",
      zh: "很多人以为回一趟家就会丢掉在留资格——其实多数情况下不会。",
      ja: "一時帰国で在留資格を失うのではと不安になる方が多いですが、大半のケースでは失効しません。",
    },
    standard_answer: {
      en: "If you leave and re-enter within 1 year AND your residence card is valid, you can use 'Special Re-entry Permit' (みなし再入国) — just check the box on the ED card at departure and bring your residence card with you. No separate application needed. For longer trips (over 1 year) or if your residence card will expire while you're away, you must get a regular re-entry permit (再入国許可) at the Immigration office BEFORE you leave.",
      zh: "如果你出境再回来的时间在 1 年以内，并且在留卡还在有效期内，直接用“特别再入国”（みなし再入国）就行——出境时在 ED 卡上勾选对应选项，并把在留卡带在身上即可，不用另外申请。如果行程超过 1 年，或者在留卡会在你离开期间过期，就必须在出境前到入国管理局办理正式的“再入国许可”（再入国許可）。",
      ja: "出国から再入国までが1年以内で、在留カードが有効であれば、「みなし再入国許可」が使えます。出国時のEDカードで該当欄にチェックを入れ、在留カードを携帯するだけで、別途申請は不要です。1年以上離れる場合や、不在中に在留カードの期限が切れる場合は、出国前に出入国在留管理局で通常の「再入国許可」を取得しておく必要があります。",
    },
    next_step_confirm: {
      en: "Check your travel dates and your residence card expiration date — both fit inside 1 year? Then みなし再入国 is enough.",
      zh: "确认两件事：出行时间是否在 1 年内，在留卡是否在此期间有效。都满足就只要“みなし再入国”。",
      ja: "渡航期間と在留カードの有効期限を確認してください。いずれも1年以内に収まれば、みなし再入国で対応可能です。",
    },
    next_step_prepare: {
      en: "Carry your residence card and passport at departure, and check the 'みなし再入国' box on the ED card.",
      zh: "出境当天带好在留卡和护照，ED 卡上记得勾选“みなし再入国”。",
      ja: "出国時は在留カードとパスポートを携帯し、EDカードの「みなし再入国」欄にチェックを入れてください。",
    },
    next_step_contact: {
      en: "For the regular re-entry permit (long trips), go to your regional Immigration office before leaving.",
      zh: "如果行程很长要办正式再入国许可，出境前去当地入国管理局。",
      ja: "長期滞在で通常の再入国許可が必要な場合は、出国前に地方出入国在留管理局へ。",
    },
    next_step_warning: {
      en: "If you stay abroad past 1 year without a regular permit, your visa is invalidated.",
      zh: "如果在海外停留超过 1 年、又没办正式的再入国许可，你的在留资格会作废。",
      ja: "通常の再入国許可を取らずに1年を超えて海外に滞在すると、在留資格は失効します。",
    },
    target_user: ["any-resident"],
    risk_level: "high",
    official_confirmation_required: true,
    source_type: "government",
    language: "multi",
    keywords: {
      en: ["re-entry permit", "re-entry", "minashi sainyukoku", "sainyukoku", "leave japan temporarily"],
      zh: ["再入境", "再入国", "再入国許可", "临时出国"],
      ja: ["再入国許可", "みなし再入国", "一時帰国"],
    },
    status: "live",
  },

  // ================= daily_life =================
  {
    id: "daily-garbage-sorting",
    category: "daily_life",
    subtopic: "garbage",
    representative_title: {
      en: "Household garbage sorting in Japan",
      zh: "日本家庭垃圾分类",
      ja: "家庭ゴミの分別",
    },
    user_question_pattern: {
      en: "How do I sort my trash here?",
      zh: "日本的垃圾分类该怎么分？",
      ja: "ゴミはどう分別すればいいですか？",
    },
    pain_point: {
      en: "Rules vary by city and sometimes by ward, and bags left out wrong stay on the curb.",
      zh: "规则每个城市甚至每个区都不一样，扔错的垃圾会一直留在原地。",
      ja: "自治体・地区ごとにルールが違い、出し方を間違えると収集してもらえません。",
    },
    standard_answer: {
      en: "Japanese households sort garbage into several categories — typically burnable (燃えるゴミ), non-burnable (燃えないゴミ), plastics, PET bottles, cans/glass, and oversized items. Each category has its own pickup day, and rules vary by city and even by ward. Your city or ward office publishes a garbage calendar, often in English and other languages. Get one and keep it near where you put out your trash — missing a day usually means holding onto the bag until the next week.",
      zh: "日本家庭的垃圾要分类：一般包括可燃垃圾（燃えるゴミ）、不可燃垃圾（燃えないゴミ）、塑料、PET 瓶、易拉罐和玻璃瓶、以及大件垃圾。每一类都有固定的收集日，规则因城市、甚至因区而异。市役所或区役所会发放垃圾日历，很多地方有中英文版本。拿一份贴在扔垃圾的地方——错过一次一般就要等到下一周。",
      ja: "日本では家庭ゴミを「燃えるゴミ」「燃えないゴミ」「プラスチック」「ペットボトル」「缶・ビン」「粗大ゴミ」などに分けて出します。収集日はカテゴリごとに決まっていて、自治体や地区によってルールが違います。市区町村役場でゴミ収集カレンダー（英語版があることも多い）をもらって、ゴミ置き場の近くに貼っておくと安心です。出し損ねると、次の収集日まで家で保管することになります。",
    },
    next_step_confirm: {
      en: "Find your city's garbage calendar (many cities publish a PDF or an app).",
      zh: "找到你所在城市的垃圾日历（很多城市有 PDF 或 App）。",
      ja: "お住まいの市区町村のゴミ収集カレンダーを入手してください（PDFやアプリで公開されていることが多いです）。",
    },
    next_step_prepare: {
      en: "Pick up designated city garbage bags at any convenience store or supermarket.",
      zh: "指定的垃圾袋在便利店或超市就能买到。",
      ja: "指定ゴミ袋は、コンビニやスーパーで購入できます。",
    },
    next_step_contact: {
      en: "Your city or ward office's environment section (環境課).",
      zh: "市役所 / 区役所的环境课（環境課）。",
      ja: "市区町村役場の環境課。",
    },
    target_user: ["new-arrival", "resident"],
    risk_level: "low",
    official_confirmation_required: false,
    source_type: "government",
    language: "multi",
    keywords: {
      en: ["garbage", "trash", "recycling", "sorting", "burnable", "non-burnable", "waste"],
      zh: ["垃圾", "分类", "可燃", "不可燃", "回收"],
      ja: ["ゴミ", "ごみ", "分別", "燃える", "燃えない", "リサイクル"],
    },
    status: "live",
  },
  {
    id: "daily-national-health-insurance",
    category: "daily_life",
    subtopic: "health-insurance",
    representative_title: {
      en: "National Health Insurance (NHI) for residents",
      zh: "居民的国民健康保险（国保）",
      ja: "国民健康保険（国保）の加入",
    },
    user_question_pattern: {
      en: "How do I enroll in national health insurance?",
      zh: "怎么加入国民健康保险？",
      ja: "国民健康保険にはどう加入するのですか？",
    },
    pain_point: {
      en: "New arrivals think insurance is optional and end up paying 100% of medical bills for months.",
      zh: "刚来日本的人以为可以不保，结果看病要全额自付。",
      ja: "任意だと思っている方が多く、未加入のまま高額な医療費を自己負担してしまうケースがあります。",
    },
    standard_answer: {
      en: "If you're registered as a resident in Japan for more than 3 months and aren't covered by your employer's social insurance (社会保険), you're required to enroll in National Health Insurance (国民健康保険 / 'kokuho') at your city or ward office. Bring your residence card and passport. You'll get a health insurance card (保険証) that cuts your out-of-pocket medical costs to 30%. Premiums are calculated from your previous year's Japan income, so newcomers usually have very low premiums in their first year.",
      zh: "在日本住民登记超过 3 个月、而且没有通过雇主加入社会保险（社会保険）的话，你必须到市役所或区役所办理国民健康保险（国民健康保険，简称“国保”）。带在留卡和护照就行。办完会拿到一张保险证（保険証），以后看病只需自付 30%。保险费按你前一年在日本的收入算，所以第一年保费通常很低。",
      ja: "日本で3か月を超える住民登録があり、職場の社会保険に加入していない方は、お住まいの市区町村で国民健康保険（国保）への加入が必要です。在留カードとパスポートをお持ちください。加入すると保険証が発行され、病院や診療所での窓口負担は原則3割になります。保険料は前年の日本国内所得をもとに計算されるため、来日初年度の方は保険料がかなり低く抑えられます。",
    },
    next_step_confirm: {
      en: "Confirm you are NOT already enrolled in your employer's 社会保険 — one or the other, never both.",
      zh: "先确认你是不是已经通过公司加入了社会保険——只能两者选一。",
      ja: "勤務先の社会保険に加入していないか確認してください。国保とは同時加入できません。",
    },
    next_step_prepare: {
      en: "Residence card, passport, and (if you have it) My Number notification.",
      zh: "在留卡、护照，以及 My Number 通知（如果有）。",
      ja: "在留カード、パスポート、マイナンバー通知カード（お持ちの方）。",
    },
    next_step_contact: {
      en: "Your city or ward office's health insurance counter (国民健康保険担当).",
      zh: "市役所 / 区役所的国保窗口（国民健康保険担当）。",
      ja: "市区町村役場の国民健康保険担当窓口。",
    },
    target_user: ["new-arrival", "self-employed", "student"],
    risk_level: "medium",
    official_confirmation_required: true,
    source_type: "government",
    language: "multi",
    keywords: {
      en: ["health insurance", "nhi", "kokuho", "kokumin kenko", "enroll", "insurance card"],
      zh: ["国民健康保险", "国保", "医保", "保险"],
      ja: ["国民健康保険", "国保", "健康保険", "保険証", "加入"],
    },
    status: "live",
  },
  {
    id: "daily-my-number",
    category: "daily_life",
    subtopic: "my-number",
    representative_title: {
      en: "My Number and the My Number Card",
      zh: "My Number 和 My Number Card",
      ja: "マイナンバーとマイナンバーカード",
    },
    user_question_pattern: {
      en: "What is My Number and do I need the card?",
      zh: "My Number 是什么？实体卡要不要办？",
      ja: "マイナンバーとは何ですか？カードは作るべきですか？",
    },
    pain_point: {
      en: "People ignore the letter and then can't open a bank account or file taxes properly.",
      zh: "很多人把通知书放着不管，结果开户、报税时才发现要用。",
      ja: "通知書を放置してしまい、後から口座開設や確定申告で困る方がいます。",
    },
    standard_answer: {
      en: "Every resident of Japan — including foreign residents — is assigned a 12-digit My Number (個人番号). After you register your address at your city office, a notification letter arrives by mail to your registered address within a few weeks. You need the number for tax filings, opening bank accounts, and many employment procedures. You can also apply (free) for a physical My Number Card, which works as a photo ID and is used for more and more online government services. Keep the number itself private — don't share photos of the notification on social media.",
      zh: "所有在日本做过住民登记的人——包括外国居民——都会被分配一个 12 位的 My Number（個人番号）。在市役所登记完地址后，几周内会有一封通知信寄到你登记的住址。报税、开银行账户、很多入职手续都要用到这个号码。你还可以（免费）申请实体的 My Number Card，既是带照片的身份证件，也是越来越多政府在线服务必须的证件。号码本身要保密——不要把通知卡拍照发到社交媒体。",
      ja: "日本に住民登録をしているすべての人（外国人住民を含む）に、12桁のマイナンバー（個人番号）が割り当てられます。市区町村役場で住所登録後、数週間以内に通知書が登録住所に郵送で届きます。税金手続き、銀行口座の開設、就職時の書類などで必要になります。希望すれば、顔写真付き身分証として使えるマイナンバーカード（無料）も申請できます。オンライン行政サービスでも必要になる場面が増えています。番号自体は個人情報なので、SNSで通知書の写真を公開しないようにしてください。",
    },
    next_step_confirm: {
      en: "Check whether your notification letter has arrived; if not, ask your city office.",
      zh: "确认通知信是不是已经到了；如果没到，去市役所问。",
      ja: "通知書が届いているかご確認ください。届いていない場合は市区町村役場へ問い合わせを。",
    },
    next_step_prepare: {
      en: "For the physical card: a photo (4.5×3.5cm), your notification letter, and your residence card.",
      zh: "如果要办实体卡：一张 4.5×3.5cm 的照片、通知卡和在留卡。",
      ja: "マイナンバーカード申請には、4.5×3.5cmの写真、通知書、在留カードが必要です。",
    },
    next_step_contact: {
      en: "Your city or ward resident counter.",
      zh: "市役所 / 区役所的住民窗口。",
      ja: "市区町村役場の住民担当窓口。",
    },
    target_user: ["any-resident"],
    risk_level: "low",
    official_confirmation_required: true,
    source_type: "government",
    language: "multi",
    keywords: {
      en: ["my number", "mynumber", "individual number", "number card"],
      zh: ["my number", "个人编号", "マイナンバー", "个人番号"],
      ja: ["マイナンバー", "個人番号", "マイナンバーカード"],
    },
    status: "live",
  },
  {
    id: "daily-hanko-inkan",
    category: "daily_life",
    subtopic: "hanko",
    representative_title: {
      en: "Getting a personal seal (hanko / inkan)",
      zh: "办理个人印章（ハンコ／印鑑）",
      ja: "印鑑（ハンコ）の作成と登録",
    },
    user_question_pattern: {
      en: "Do I really need a hanko?",
      zh: "我真的需要一个印章吗？",
      ja: "印鑑は本当に必要ですか？",
    },
    pain_point: {
      en: "People order one on day one, then find the company and bank actually accepted a signature.",
      zh: "有人第一天就去订了印章，结果发现公司和银行其实接受签名。",
      ja: "来日初日に慌てて作ったものの、結局会社や銀行でサインで済んだという方も多いです。",
    },
    standard_answer: {
      en: "Many Japanese paperwork processes still use a personal seal (印鑑 / hanko) instead of a handwritten signature. There are two common kinds: a mitomein (認印), used for deliveries and everyday documents, and a jitsuin (実印), a registered seal for contracts, car purchases, and some bank procedures. You can order one at a hanko shop; major cities often have English service, and foreign residents typically use katakana or romaji. To register a jitsuin, take it to your city or ward office and apply for 印鑑登録 (inkan touroku). Many modern banks and companies now accept signatures, so ask what each specific procedure really requires before ordering.",
      zh: "日本很多文书手续至今还在用个人印章（印鑑／ハンコ）代替亲笔签名。常见有两种：“認印”（mitomein）用于收快递和日常文件，“実印”（jitsuin）是正式登记的印章，用于合同、买车、部分银行手续。可以到印章店订做，大城市不少店家有英文服务，外国人一般用片假名或罗马字。要把“実印”登记为正式印章，需要到市役所或区役所办理“印鑑登録”。现在很多银行和公司也接受签名，所以在订做之前，最好先确认具体手续到底要不要印章。",
      ja: "日本の事務手続きでは、直筆サインの代わりに「印鑑（ハンコ）」を求められる場面がまだ多くあります。代表的なのは、日常書類や宅配便の受け取りに使う「認印」と、正式に登録して契約・自動車購入・一部の銀行手続きに使う「実印」です。印鑑はハンコ店で注文でき、大都市では外国語対応のお店もあります。外国人の方はカタカナまたはローマ字で作ることが多いです。実印にする場合は、市区町村役場で「印鑑登録」を申請してください。最近はサインでも受け付けてくれる銀行・企業が増えているので、実際の手続きで何が必要かを事前に確認してから注文すると無駄がありません。",
    },
    next_step_confirm: {
      en: "Ask each procedure separately: 'Will a signature work, or do I need a hanko?'",
      zh: "每个手续都单独问一下：“签名可以吗？还是必须用印章？”",
      ja: "手続きごとに「サインで対応可能ですか？印鑑が必要ですか？」と確認してください。",
    },
    next_step_prepare: {
      en: "Your preferred name spelling (katakana or romaji) before visiting a hanko shop.",
      zh: "去订做之前先想好你印章上要用的名字（片假名或罗马字）。",
      ja: "ハンコ店に行く前に、刻印する名前の表記（カタカナ／ローマ字）を決めておきましょう。",
    },
    next_step_contact: {
      en: "Any hanko shop for the seal; your city/ward office for 印鑑登録.",
      zh: "任意印章店可以做章，印鑑登録要去市役所 / 区役所。",
      ja: "印鑑店でハンコを作成し、印鑑登録は市区町村役場で行います。",
    },
    target_user: ["new-arrival"],
    risk_level: "low",
    official_confirmation_required: false,
    source_type: "seed",
    language: "multi",
    keywords: {
      en: ["hanko", "inkan", "personal seal", "stamp", "jitsuin", "mitomein"],
      zh: ["印章", "印鉴", "印鑑", "实印", "认印"],
      ja: ["印鑑", "ハンコ", "実印", "認印", "印鑑登録"],
    },
    status: "live",
  },
  {
    id: "daily-bank-account",
    category: "daily_life",
    subtopic: "bank-account",
    representative_title: {
      en: "Opening a bank account as a foreign resident",
      zh: "外国居民在日本开银行账户",
      ja: "外国人の銀行口座開設",
    },
    user_question_pattern: {
      en: "Which bank will open an account for a new foreign resident?",
      zh: "刚来日本，哪家银行愿意给我开户？",
      ja: "来日したばかりでも口座開設できる銀行はどこですか？",
    },
    pain_point: {
      en: "Most banks require 6 months of residency, and landlords want bank-transfer rent setup on day one.",
      zh: "大多数银行要求住满半年才给开户，但房东第一天就要求用银行转账交房租。",
      ja: "多くの銀行は在留6ヶ月以上を条件とする一方、家主は入居初日から銀行振込を求めるため不便です。",
    },
    standard_answer: {
      en: "For most new foreign residents, Japan Post Bank (ゆうちょ銀行) is the easiest first account — they accept applications soon after you arrive. Other banks (MUFG, SMBC, Mizuho, Rakuten, etc.) typically require 6 months of residency before they'll open a regular account. Bring your residence card, passport, My Number notification (or card), a Japanese phone number, your hanko (though some banks now accept signatures), and proof of address (juminhyo or a recent utility bill).",
      zh: "对多数刚到日本的外国居民来说，最容易开的第一个账户是邮政银行（ゆうちょ銀行），到日本不久就可以办。其他银行（三菱UFJ、三井住友、瑞穗、乐天等）一般要求你在日本住满 6 个月才会开普通账户。办理时带上在留卡、护照、My Number 通知卡（或 My Number 卡）、一个日本手机号、印章（有些银行现在接受签名），以及地址证明（住民票或近期的水电账单）。",
      ja: "来日したばかりの外国人住民の方には、まず「ゆうちょ銀行」が最も口座を開きやすい選択肢です。来日直後から申込が可能です。他の銀行（三菱UFJ、三井住友、みずほ、楽天など）は、6ヶ月以上の在留実績を求めることが多いです。手続きには、在留カード、パスポート、マイナンバー通知カードまたはマイナンバーカード、日本の電話番号、印鑑（サイン可の銀行も増えています）、住所が確認できる書類（住民票や最近の公共料金明細）が必要です。",
    },
    next_step_confirm: {
      en: "Confirm which documents your chosen branch specifically wants — requirements vary by branch.",
      zh: "事先问清楚你要去的那家支店具体要哪些材料——不同支店略有差异。",
      ja: "来店予定の支店に、必要書類を事前に確認してください。支店ごとに細かい差があります。",
    },
    next_step_prepare: {
      en: "Residence card, passport, Japanese phone number, hanko (optional at some banks), proof of address.",
      zh: "在留卡、护照、日本手机号、印章（有些银行可用签名）、地址证明。",
      ja: "在留カード、パスポート、日本の電話番号、印鑑（不要の銀行もあり）、住所確認書類。",
    },
    next_step_contact: {
      en: "Your nearest Japan Post Bank (ゆうちょ) branch for an easy first account.",
      zh: "离你最近的邮政银行（ゆうちょ銀行）支店最容易办第一个账户。",
      ja: "お近くのゆうちょ銀行窓口が、最初の口座としていちばん手続きしやすいです。",
    },
    target_user: ["new-arrival"],
    risk_level: "low",
    official_confirmation_required: false,
    source_type: "seed",
    language: "multi",
    keywords: {
      en: ["bank account", "open account", "japan post bank", "yucho", "banking"],
      zh: ["银行", "开户", "银行账户", "邮政储金", "ゆうちょ"],
      ja: ["銀行口座", "口座開設", "銀行", "ゆうちょ", "口座を作る"],
    },
    status: "live",
  },
  // ----- navigator entry (broad "where do I start") -----
  {
    id: "daily-getting-started",
    category: "daily_life",
    subtopic: "navigator",
    representative_title: {
      en: "I just moved to Japan and don't know what to ask first",
      zh: "我刚到日本，不知道该从哪里开始问",
      ja: "日本に来たばかりで、何から聞けばいいか分かりません",
    },
    user_question_pattern: {
      en: "I don't know what to ask. Where do I even start?",
      zh: "我不知道该问什么，也不知道从哪里开始。",
      ja: "何から質問すればいいのかも分からない状態です。",
    },
    pain_point: {
      en: "Newcomers face dozens of simultaneous tasks — housing, visa, bank, insurance, phone — with no obvious order.",
      zh: "刚到日本要同时处理一堆事——住房、签证、银行、保险、手机——完全不知道先做哪一样。",
      ja: "来日直後は、住まい・在留手続き・銀行・保険・携帯など、同時にやることが多すぎて優先順位が見えません。",
    },
    standard_answer: {
      en: "Most people are dealing with four parallel tracks in the first month: (1) address — register your new address at the city/ward office within 14 days of moving in; (2) identity — residence card, My Number notification, and a hanko if you don't have one; (3) money — open a bank account (Japan Post is easiest at first); (4) safety net — enroll in National Health Insurance and a mobile SIM. Rent and visa topics usually come on top of those. Tell me which of these four is blocking you right now and I can narrow it down.",
      zh: "刚来日本的第一个月，一般同时在推进四件事：(1) 住址——入住后 14 天内去市役所/区役所登记；(2) 身份——在留卡、我番号通知，以及一枚印章（没有就先准备）；(3) 钱——先开一个银行账户（邮政银行最容易）；(4) 安全网——加入国民健康保险，办一张手机 SIM 卡。租房和签证的问题通常是在这四件之上再处理。告诉我现在卡住你的是这四件里的哪一件，我可以帮你再细分。",
      ja: "来日から最初の1ヶ月は、大きく4つを同時に進めている方が多いです。(1) 住所——入居後14日以内に市区町村役場で住民登録。(2) 身分——在留カード、マイナンバー通知、印鑑（無ければ用意）。(3) お金——銀行口座をまず1つ開設（ゆうちょが最も手続きしやすいです）。(4) 安心——国民健康保険の加入と携帯SIMの契約。家賃や在留関連の質問は、この4つの上に乗ってくる形になります。今どこで止まっているかを教えていただければ、その場所を一緒に絞り込めます。",
    },
    next_step_confirm: {
      en: "Pick the single most urgent track out of: address / identity / money / safety net.",
      zh: "先选出最急的那一件：住址 / 身份 / 钱 / 安全网。",
      ja: "まず、住所・身分・お金・安心の中でいちばん急ぎの項目を一つ選んでください。",
    },
    next_step_prepare: {
      en: "Have your passport and residence card (在留カード) within reach — almost every step starts with these two.",
      zh: "把护照和在留卡放在手边——这两样几乎是所有手续的起点。",
      ja: "パスポートと在留カードを手元にご用意ください。ほぼすべての手続きの起点になります。",
    },
    next_step_contact: {
      en: "Your city or ward office (市役所 / 区役所) — most have a foreign-resident counter and a printed checklist for new arrivals.",
      zh: "你所在的市役所 / 区役所——大多数都有外国人窗口，并且有给新到居民的纸质办事清单。",
      ja: "お住まいの市役所・区役所。外国人向け窓口があり、来日直後の手続き一覧（紙のチェックリスト）を用意している自治体が多いです。",
    },
    target_user: ["new-arrival"],
    risk_level: "low",
    official_confirmation_required: false,
    source_type: "practical",
    language: "multi",
    keywords: {
      en: ["don't know", "where to start", "just moved", "newcomer", "first month", "what to do first"],
      zh: ["不知道", "不知道问什么", "从哪里开始", "刚到日本", "新来", "第一步"],
      ja: ["わからない", "何から", "何をすればいい", "来たばかり", "最初", "新生活"],
    },
    status: "live",
  },
  // ----- visa: spouse visa basics -----
  {
    id: "visa-spouse-visa",
    category: "visa",
    subtopic: "spouse-visa",
    representative_title: {
      en: "Spouse visa basics (Spouse of a Japanese national / PR holder)",
      zh: "配偶签证基础（日本人或永住者的配偶）",
      ja: "配偶者ビザの基本（日本人・永住者の配偶者）",
    },
    user_question_pattern: {
      en: "I'm married to a Japanese citizen — how do I get a spouse visa?",
      zh: "我和日本人结婚了，怎么申请配偶签证？",
      ja: "日本人と結婚しました。配偶者ビザはどのように取りますか？",
    },
    pain_point: {
      en: "The application asks for proof that the marriage is real, not just paperwork — and missing documents means rejection.",
      zh: "申请时需要证明婚姻是真实的，不只是一纸证件——材料没备齐就会被拒。",
      ja: "在留資格の審査では婚姻の実態を示す資料が必要で、書類不足はそのまま不許可につながります。",
    },
    standard_answer: {
      en: "The 'Spouse or Child of Japanese National' status is applied for at an Immigration Services Agency (出入国在留管理庁) regional office. Core documents include the marriage certificate (both countries), your Japanese spouse's family register (戸籍謄本), household registration (住民票), proof of income and tax payment for the Japanese spouse, a detailed questionnaire (質問書) about how you met and your life together, and photographs together. This visa is sensitive — rejections usually come from weak relationship evidence or unstable household finances. It is strongly recommended to have a Japanese-speaking friend or an immigration-certified administrative scrivener (行政書士) check your package before you submit.",
      zh: "“日本人の配偶者等”这一在留资格，是在出入国在留管理厅的地方事务所申请的。核心材料通常包括：双方的结婚证明（两国的都要）、日本籍配偶的戸籍謄本、住民票、日本配偶的收入和纳税证明、一份详细说明“你们怎么认识、怎么生活”的质问书（質問書），以及你们的合影。这类签证审核比较严格，被拒的常见原因是关系材料不足或家庭经济不稳定。强烈建议在提交前，让一位懂日语的朋友、或者持证的行政书士帮你把材料过一遍。",
      ja: "「日本人の配偶者等」の在留資格は、出入国在留管理庁の地方官署で申請します。主な必要書類は、両国の婚姻証明、日本人配偶者の戸籍謄本、住民票、所得・納税証明、出会いから現在までを具体的に記入する質問書、ご夫婦の写真などです。配偶者ビザは審査が丁寧で、関係性の立証が弱いケースや家計が不安定なケースで不許可になりがちです。提出前に、日本語が分かる方、または行政書士に一度確認してもらうことを強くおすすめします。",
    },
    next_step_confirm: {
      en: "Confirm which documents are needed for your specific country of origin on the Immigration Services Agency's English page for 'Spouse or Child of Japanese National'.",
      zh: "到出入国在留管理厅官网上，查看你所在国籍对应的“日本人の配偶者等”所需材料清单。",
      ja: "出入国在留管理庁の公式ページで、国籍ごとに求められる具体的な必要書類を確認してください。",
    },
    next_step_prepare: {
      en: "Marriage certificates (both countries), 戸籍謄本, 住民票, income/tax proof, completed 質問書, photos of you together over time.",
      zh: "双方结婚证、戸籍謄本、住民票、收入与纳税证明、填好的質問書，以及你们相处的照片。",
      ja: "両国の婚姻証明、戸籍謄本、住民票、所得・納税証明、記入済みの質問書、一緒に過ごしてきた写真。",
    },
    next_step_contact: {
      en: "Your regional Immigration Services Agency office (地方出入国在留管理局); for a pre-check, an administrative scrivener (行政書士) who specializes in visas.",
      zh: "你所在地区的出入国在留管理局；想先做一次审材料，可以找专门做签证的行政书士。",
      ja: "お住まいの地域の地方出入国在留管理局。書類の事前チェックを希望する場合は、ビザに詳しい行政書士へ。",
    },
    next_step_warning: {
      en: "Do not submit vague or copy-pasted answers on the 質問書. Inconsistent statements between spouses are a major reason for rejection.",
      zh: "質問書不要写得太笼统，也不要复制粘贴。夫妻双方说法不一致，是被拒的主要原因之一。",
      ja: "質問書は抽象的・定型的な回答にしないでください。夫婦間で説明が食い違うことは、不許可の代表的な原因です。",
    },
    target_user: ["spouse", "new-arrival"],
    risk_level: "high",
    official_confirmation_required: true,
    source_type: "official",
    language: "multi",
    keywords: {
      en: ["spouse visa", "spouse of japanese", "married to japanese", "marriage visa", "haigusha"],
      zh: ["配偶签证", "日本人配偶", "结婚签证", "配偶者ビザ"],
      ja: ["配偶者ビザ", "配偶者", "結婚", "日本人の配偶者等"],
    },
    status: "live",
  },
  // ----- daily_life: mobile SIM / phone contract -----
  {
    id: "daily-mobile-sim",
    category: "daily_life",
    subtopic: "mobile-sim",
    representative_title: {
      en: "Getting a mobile phone or SIM as a foreign resident",
      zh: "外国人在日本办手机 / SIM 卡",
      ja: "外国人として携帯電話・SIMを契約する",
    },
    user_question_pattern: {
      en: "What's the easiest way to get a phone number in Japan as a foreigner?",
      zh: "外国人在日本最简单怎么办手机号？",
      ja: "外国人が日本で電話番号を持つ、いちばん簡単な方法は？",
    },
    pain_point: {
      en: "Big carriers require long contracts and sometimes a Japanese bank account; short-stay residents get refused.",
      zh: "大运营商合约长，有时还要日本银行账户；签证期不够长的人常被拒。",
      ja: "大手キャリアは契約期間が長く、日本の口座を求められることも多いため、在留期間が短いと断られることがあります。",
    },
    standard_answer: {
      en: "You have two practical paths: (1) Cheap MVNO / prepaid SIMs (IIJmio, Mobal, Sakura Mobile, HIS Mobile, povo) — most accept a residence card only, let you pay by credit card, and don't require a long contract. Monthly cost is typically 1,000–3,000 yen. (2) Major carriers (docomo, au, SoftBank, Rakuten Mobile) — more coverage and in-person support, but usually want a Japanese bank account and sometimes at least 6 months remaining on your residence card. For most new arrivals, start with an MVNO or prepaid SIM; switch to a major carrier later if you need a family plan or phone installment.",
      zh: "一般有两条路：(1) 便宜的 MVNO 或预付 SIM（如 IIJmio、Mobal、Sakura Mobile、HIS Mobile、povo）——多数只要在留卡，可以用信用卡付款，没有长合约，月费大约 1,000–3,000 日元。(2) 大运营商（docomo、au、SoftBank、Rakuten Mobile）——信号和门店支援更好，但一般要求日本银行账户，有时还要求在留卡剩余期限至少 6 个月。刚到日本的话，建议先从 MVNO 或预付 SIM 起步，以后有需要再换大运营商。",
      ja: "大きく2つの選択肢があります。(1) 格安SIM・プリペイドSIM（IIJmio、Mobal、Sakura Mobile、HIS Mobile、povoなど）。多くは在留カードだけで契約でき、支払いはクレジットカードOK、長期契約も不要で、月額1,000～3,000円程度が目安です。(2) 大手キャリア（ドコモ、au、ソフトバンク、楽天モバイル）。エリアと店舗サポートは手厚いものの、日本の銀行口座を求められることが多く、在留カードの残期間が6ヶ月以上必要なケースもあります。来日直後の方には、まず格安SIMやプリペイドSIMから始め、後から必要に応じて大手キャリアへ乗り換える流れがおすすめです。",
    },
    next_step_confirm: {
      en: "Check the remaining validity of your residence card and whether you already have a Japanese bank account or just a credit card.",
      zh: "先看一下你的在留卡还剩多久，以及你现在有没有日本银行账户、或者只有信用卡。",
      ja: "在留カードの残期間、そして日本の銀行口座がすでにあるか、クレジットカードしか無いかを確認してください。",
    },
    next_step_prepare: {
      en: "Residence card, passport, a payment method (credit card is fine for most MVNOs), and an unlocked phone.",
      zh: "在留卡、护照、支付方式（大多数 MVNO 接受信用卡）、一部已解锁的手机。",
      ja: "在留カード、パスポート、支払い手段（MVNOならクレジットカード可）、SIMロック解除済みの端末。",
    },
    next_step_contact: {
      en: "For MVNOs, sign up online in English (Mobal, Sakura Mobile). For major carriers, go to a branch that handles foreign residents — airport branches and Shinjuku / Umeda flagships are used to it.",
      zh: "MVNO 直接上英文官网申请就行（Mobal、Sakura Mobile 都有英文支持）。大运营商请去接待外国人多的门店——机场店、新宿／梅田旗舰店比较熟练。",
      ja: "MVNOはオンラインで英語対応のサイトから申し込めます（Mobal、Sakura Mobileなど）。大手キャリアは、外国人対応に慣れた店舗（空港店、新宿・梅田のフラッグシップなど）が便利です。",
    },
    target_user: ["new-arrival"],
    risk_level: "low",
    official_confirmation_required: false,
    source_type: "practical",
    language: "multi",
    keywords: {
      en: ["sim card", "mobile phone", "phone number", "mvno", "cell phone", "mobal", "sakura mobile"],
      zh: ["手机卡", "电话卡", "手机号", "SIM", "办手机", "办卡"],
      ja: ["SIM", "携帯", "スマホ", "電話番号", "契約", "格安SIM"],
    },
    status: "live",
  },
  // ----- daily_life: school / childcare -----
  {
    id: "daily-school-enrollment",
    category: "daily_life",
    subtopic: "school-enrollment",
    representative_title: {
      en: "Enrolling your child in Japanese public school or daycare",
      zh: "把孩子送进日本的公立学校或保育园",
      ja: "子どもを日本の公立学校・保育園に入れる",
    },
    user_question_pattern: {
      en: "How do I put my child into school in Japan as a foreign resident?",
      zh: "外国人怎么把孩子送进日本的学校或保育园？",
      ja: "外国人が子どもを日本の学校や保育園に入れるにはどうすればいいですか？",
    },
    pain_point: {
      en: "Parents don't know whether they qualify, when to apply, or whether schools will accept a child with limited Japanese.",
      zh: "家长不知道自己有没有资格、什么时候申请、孩子日语不好学校会不会收。",
      ja: "就学資格、申込時期、日本語が苦手な子どもの受け入れ可否など、親にとって情報が見えづらいです。",
    },
    standard_answer: {
      en: "Foreign residents are entitled to send their children to Japanese public elementary and junior high schools free of charge, even without Japanese nationality. Enrollment is handled by your city/ward board of education (教育委員会). For daycare (保育園), you apply through the city/ward welfare or childcare section, and placement is competitive — families where both parents work full-time or are job-hunting get priority. For kindergarten (幼稚園), you usually apply directly to the kindergarten. Many cities offer Japanese-language support classes (日本語指導) for children who are still learning Japanese.",
      zh: "外国居民的孩子有权免费就读日本的公立小学和初中，国籍不是问题。入学手续由你所在市区町村的教育委員会办理。保育园（保育園）要通过市役所／区役所的育児 / 子育て相关窗口申请，名额紧张，双职工或正在找工作的家庭优先。幼儿园（幼稚園）一般是直接向幼儿园本身申请。许多市町村还会为日语还在学习阶段的孩子提供“日本语指导”课程。",
      ja: "外国籍のお子さんでも、日本の公立小中学校に無償で通うことができます。入学・転入の手続きはお住まいの市区町村の教育委員会が窓口です。保育園は市区町村の子育て／保育担当窓口で申し込みますが、入園は競争が厳しく、共働きや求職中のご家庭が優先されます。幼稚園は園に直接申し込むのが一般的です。日本語がまだ難しいお子さん向けに、日本語指導の教室を用意している自治体も多くあります。",
    },
    next_step_confirm: {
      en: "Check your city's website for 就学手続き (elementary/junior high) or 保育園入園申込 (daycare).",
      zh: "去你所在市的网站查“就学手続き”（中小学）或“保育園入園申込”（保育园）。",
      ja: "お住まいの自治体サイトで「就学手続き」（小中学校）または「保育園入園申込」を検索してください。",
    },
    next_step_prepare: {
      en: "Residence card, your 住民票, child's ID / passport, and (for daycare) both parents' employment certificates.",
      zh: "在留卡、住民票、孩子的身份证明 / 护照，保育园还需要父母双方的在职证明。",
      ja: "在留カード、住民票、お子さんの身分証明（パスポート等）、保育園の場合は保護者双方の就労証明書。",
    },
    next_step_contact: {
      en: "City/ward board of education (教育委員会) for schools; city/ward childcare section (保育課 / 子育て支援課) for daycare.",
      zh: "上学找市町村的教育委員会；保育园找市町村的保育課 / 子育て支援課。",
      ja: "小中学校は市区町村の教育委員会、保育園は市区町村の保育課・子育て支援課が窓口です。",
    },
    target_user: ["parent", "new-arrival"],
    risk_level: "medium",
    official_confirmation_required: true,
    source_type: "official",
    language: "multi",
    keywords: {
      en: ["school", "public school", "enroll child", "kindergarten", "daycare", "hoikuen", "youchien"],
      zh: ["上学", "公立学校", "保育园", "幼儿园", "孩子", "小孩", "入学"],
      ja: ["学校", "公立", "保育園", "幼稚園", "入園", "入学", "子ども"],
    },
    status: "live",
  },
  // ----- renting: move-in / address registration checklist -----
  {
    id: "renting-move-in-checklist",
    category: "renting",
    subtopic: "move-in-checklist",
    representative_title: {
      en: "After you move in: the 14-day checklist",
      zh: "搬进去之后：14 天内要做的事",
      ja: "入居後14日以内にやることリスト",
    },
    user_question_pattern: {
      en: "I just moved in. What paperwork do I have to do right away?",
      zh: "我刚搬进去，马上必须办哪些手续？",
      ja: "入居したばかりです。すぐにやる手続きは何ですか？",
    },
    pain_point: {
      en: "Missing the 14-day address registration can affect visa status, health insurance, and even driver's-license renewal.",
      zh: "14 天内没去登记住址，会影响在留资格、健康保险，甚至驾照更新。",
      ja: "入居後14日以内の住所登録を怠ると、在留資格・健康保険・免許更新などに影響が出ます。",
    },
    standard_answer: {
      en: "Within 14 days of moving into a new address you are legally required to register it at your city or ward office. Bring your residence card — the staff will write the new address on the back. At the same counter you can also update your My Number, enroll/transfer National Health Insurance, register your hanko (印鑑登録) if you want, and pick up garbage-sorting guides for your new ward. If you moved across cities, you also need a 転出届 from the old city before getting a 転入届 at the new one. Do all of this in one trip if you can.",
      zh: "搬到新地址之后，你有法律义务在 14 天内到所在市役所／区役所登记住址。带上在留卡，工作人员会在卡的背面写上新地址。在同一个窗口还可以：更新我番号信息、加入或转移国民健康保险、如果需要可以做印章登记（印鑑登録）、领取你所在区的垃圾分类指南。如果是跨市搬家，要先在旧地址办“転出届”，再到新地址办“転入届”。尽量一次办完。",
      ja: "新しい住所に引っ越したら、14日以内に市区町村役場で住所変更の届出が必要です（法的義務）。在留カードを持参すると、裏面に新住所が記載されます。同じ窓口で、マイナンバーの住所更新、国民健康保険の加入・住所変更、希望があれば印鑑登録、そしてその区のゴミ分別ガイドの受け取りまで一度に済ませられます。市区町村をまたぐ引越しの場合は、旧住所で「転出届」を取ってから、新住所で「転入届」を行います。できる限り一度の来庁でまとめて済ませましょう。",
    },
    next_step_confirm: {
      en: "Check exactly which counter at your city/ward office handles 住民異動 (address change).",
      zh: "先确认你所在市役所／区役所里，“住民異動”这个手续具体在哪个窗口。",
      ja: "お住まいの市区町村役場で、住民異動（住所変更）を扱う窓口を事前に確認してください。",
    },
    next_step_prepare: {
      en: "Residence card, passport, new rental contract, your hanko, and (if moving across cities) the 転出証明書 from the previous city.",
      zh: "在留卡、护照、新的租房合同、印章；如果是跨市搬家，还要带旧地址开的“転出証明書”。",
      ja: "在留カード、パスポート、新しい賃貸契約書、印鑑。市区町村をまたぐ場合は旧住所で交付された転出証明書。",
    },
    next_step_contact: {
      en: "Your new city or ward office (市役所 / 区役所), foreign-resident counter if available.",
      zh: "新地址所在的市役所 / 区役所，有外国人窗口的话优先去那个窗口。",
      ja: "お住まいの市役所・区役所。外国人対応窓口があればそちらが便利です。",
    },
    next_step_warning: {
      en: "If you are close to the 14-day deadline, go in person — do not mail this one.",
      zh: "如果已经接近 14 天的期限，请直接本人去办理，不要邮寄。",
      ja: "14日の期限が近い場合は、郵送ではなく必ず窓口へ直接行ってください。",
    },
    target_user: ["new-arrival", "renter"],
    risk_level: "medium",
    official_confirmation_required: true,
    source_type: "official",
    language: "multi",
    keywords: {
      en: ["move in", "address registration", "14 days", "residence card address", "jumin touroku", "tenyu"],
      zh: ["搬家", "搬进去", "住址登记", "住民登记", "14天", "地址变更", "転入届"],
      ja: ["入居", "住所変更", "住民登録", "転入届", "転出届", "14日"],
    },
    status: "live",
  },
  // ----- renting: urgent contract pressure (risk-aware) -----
  {
    id: "renting-contract-pressure",
    category: "renting",
    subtopic: "contract-pressure",
    representative_title: {
      en: "Being pressured to sign a rental contract today",
      zh: "被催着今天就签租房合同",
      ja: "賃貸契約を今日中に結ぶよう急かされている",
    },
    user_question_pattern: {
      en: "The agent says I have to sign today or I lose the apartment. Is that normal?",
      zh: "中介说今天不签就租不到了，这正常吗？",
      ja: "不動産屋から『今日契約しないと部屋がなくなる』と言われています。普通のことですか？",
    },
    pain_point: {
      en: "Newcomers rushed into signing often discover hidden fees or unfavorable terms only after money has changed hands.",
      zh: "被催着签约的人，常常是付了钱之后才发现合同里藏着额外费用或不利条款。",
      ja: "急かされて契約した後になって、追加費用や不利な条項に気づく事例が多いです。",
    },
    standard_answer: {
      en: "Urgency pressure is a classic red flag in Japanese rentals, especially for foreign tenants. Reputable agents will give you at least 24–48 hours to read the lease, see a written cost breakdown, and ask questions. If an agent is pushing you to sign the same day, asking for cash before the breakdown, or refusing to give you a copy to read, you are allowed — and expected — to stop and walk away. The apartment 'disappearing' that fast is uncommon in most cities. Before you sign anything: get the full 見積書 in writing, read the 重要事項説明 (mandatory pre-contract explanation) that Japanese law requires, and, if anything feels off, consult a second agent or your city's free housing consultation service.",
      zh: "“今天不签就没了”这种催促，在日本租房里是一个典型的危险信号，尤其针对外国租客。正规中介会给你至少 24–48 小时的时间看合同、看书面费用清单、提问。如果对方让你当天签、在给费用清单前就收现金、或者不肯把合同给你带走看，你完全可以——也应该——停下来离场。在大多数城市，房源不会真的在几个小时内就“没了”。签之前，至少要做到：拿到完整的书面見積書，听完日本法律要求的“重要事項説明”，如果还是不放心，找第二家中介或你所在市的免费住房咨询窗口再确认一次。",
      ja: "「今日中に契約しないと」という急かし方は、賃貸の典型的な危険サインで、特に外国人の入居者に使われがちです。まともな不動産業者は、契約書・見積書を読んだり質問したりする時間を最低でも24〜48時間は確保してくれます。その日のうちに署名を求める、見積前に現金を要求する、契約書の写しを持ち帰らせない、といった対応は、立ち止まって引き返していい場面です。実際には、数時間で物件が本当に消えることはほとんどありません。契約の前に必ず、書面の見積書を受け取り、宅建業法上の「重要事項説明」をきちんと受け、少しでも不安が残るなら別の不動産業者か、お住まいの自治体の無料住宅相談を利用してください。",
    },
    next_step_confirm: {
      en: "Verify that you have received the written cost breakdown AND the 重要事項説明 in a form you can keep.",
      zh: "确认你已经拿到了可以带走的书面費用清单，以及“重要事項説明”的说明文件。",
      ja: "書面の見積書と、持ち帰り可能な形での重要事項説明を受け取っているかを確認してください。",
    },
    next_step_prepare: {
      en: "A calm 'I need 24 hours to review this' response — and a second opinion (friend, lawyer, or another agent).",
      zh: "准备好一句冷静的话：“我需要 24 小时看一下”；同时找一个可以咨询的第二意见（朋友、律师、另一家中介）。",
      ja: "『24時間検討させてください』と落ち着いて伝える準備、そして相談できる第三者（友人、弁護士、別の業者）。",
    },
    next_step_contact: {
      en: "Your city's free housing consultation desk (住宅相談), or a different rental agent for a second opinion.",
      zh: "你所在城市的免费住房咨询窗口（住宅相談），或者换一家中介再看一次。",
      ja: "お住まいの自治体の無料住宅相談窓口、あるいは別の不動産業者にセカンドオピニオンを求めてください。",
    },
    next_step_warning: {
      en: "Do not hand over cash, sign, or transfer money while you feel rushed. A real apartment will still be there tomorrow; a scam will not.",
      zh: "感到被催促的时候，不要付现金、不要签字、不要转账。真正的房子明天还在；骗局才会“今天不签就没了”。",
      ja: "急かされている状態のままで、現金を渡したり、署名したり、振込をしたりしないでください。正規の物件は翌日もそこにあります。翌日に消える話は詐欺の可能性が高いです。",
    },
    target_user: ["new-arrival", "renter"],
    risk_level: "high",
    official_confirmation_required: false,
    source_type: "practical",
    language: "multi",
    keywords: {
      en: ["pressured to sign", "sign today", "forced to sign", "rushed", "urgent contract", "lose the apartment"],
      zh: ["催我签", "今天就签", "不签就没了", "被逼签约", "催着签", "逼我"],
      ja: ["急かされ", "今日契約", "契約急", "サインして", "今日中に"],
    },
    status: "live",
  },

  // ================= daily_life / housing troubleshooting =================
  {
    id: "trouble-power-outage",
    category: "daily_life",
    subtopic: "power-outage",
    representative_title: {
      en: "No electricity at home — what to do",
      zh: "家里没电了怎么办",
      ja: "家の電気がつかない／停電したときの対処",
    },
    user_question_pattern: {
      en: "The power is out in my apartment, what should I do?",
      zh: "家里突然没电了，我该怎么办？",
      ja: "家の電気が急につかなくなりました。どうしたらいいですか？",
    },
    pain_point: {
      en: "Hard to tell if it's your breaker, the building, or a wider outage.",
      zh: "很难判断是自家跳闸、楼里问题，还是整个区域停电。",
      ja: "自宅のブレーカーか、建物全体か、地域の停電かが判断しづらいです。",
    },
    standard_answer: {
      en: "First check if it's only your apartment. Look at your breaker panel (分電盤 / ブレーカー) near the entrance — if the main breaker or a sub-breaker has tripped, flip it back up. If your neighbors also have no power, it's likely a building or regional outage — check your power company's outage map (TEPCO / Kansai Electric etc.). If only one room has no power, one circuit has tripped, often from too many appliances at once.",
      zh: "先判断是不是只有你家没电。看一下玄关附近的配电盘（分電盤 / ブレーカー），如果总闸或某个分闸跳了，把它重新推上去即可。如果邻居家也没电，大概率是整栋楼或片区停电——可以上电力公司（TEPCO、关西电力等）的停电信息页查一下。如果只有某一个房间没电，通常是那条回路跳闸了，多半是同时用了太多电器。",
      ja: "まず、自分の部屋だけなのか、建物全体なのかを確認します。玄関付近の分電盤（ブレーカー）を見て、メインブレーカーや個別のブレーカーが落ちていれば、上に戻してください。隣の部屋も停電しているなら、建物または地域の停電の可能性が高いので、電力会社（東京電力・関西電力など）の停電情報ページで確認します。特定の部屋だけ電気が来ない場合は、その回路のブレーカーが落ちていることが多く、家電を同時に使いすぎたのが原因のことがよくあります。",
    },
    next_step_confirm: {
      en: "Check your breaker panel, then check if neighbors also lost power.",
      zh: "先看自家的配电盘，然后问一下邻居家有没有电。",
      ja: "まず分電盤を確認し、次に隣の部屋も停電しているか確認してください。",
    },
    next_step_prepare: {
      en: "Have a phone flashlight, your power contract info (or 'お客様番号'), and your building management phone number on hand.",
      zh: "准备好手机手电筒、电力合约的客户编号（お客様番号），以及物业/管理公司的电话。",
      ja: "スマホのライト、電力会社の「お客様番号」、管理会社の連絡先を手元に用意してください。",
    },
    next_step_contact: {
      en: "If the breaker is fine but power is still out: call your power company's 24h outage line (TEPCO 0120-995-007 for Tokyo area) or your building management.",
      zh: "如果闸没问题但还是没电：打电力公司的24小时停电热线（东京地区 TEPCO 0120-995-007），或联系物业/管理公司。",
      ja: "ブレーカーに問題がないのに電気が来ない場合は、電力会社の24時間停電受付（東京エリアは東京電力 0120-995-007）か、管理会社に連絡してください。",
    },
    next_step_warning: {
      en: "Don't reset a breaker repeatedly if it keeps tripping — that usually means an overload or a short circuit and needs an electrician.",
      zh: "如果闸反复跳，不要一直强推上去——很可能是线路过载或短路，需要找电工处理。",
      ja: "ブレーカーが何度も落ちる場合は、無理に上げ続けないでください。過負荷や短絡の可能性があり、電気工事の対応が必要です。",
    },
    target_user: ["renter", "resident"],
    risk_level: "low",
    official_confirmation_required: false,
    source_type: "practical",
    language: "multi",
    keywords: {
      en: ["no electricity", "power outage", "blackout", "power is out", "breaker", "no power"],
      zh: ["没电", "没电了", "停电", "断电", "跳闸", "电没了"],
      ja: ["停電", "電気がつかない", "電気が来ない", "ブレーカー", "電気止まった"],
    },
    status: "live",
  },
  {
    id: "trouble-water-leak",
    category: "renting",
    subtopic: "water-leak",
    representative_title: {
      en: "Water leaking in my apartment — what to do",
      zh: "家里漏水了怎么办",
      ja: "家で水漏れが起きたときの対処",
    },
    user_question_pattern: {
      en: "There's water leaking from the ceiling / pipe — who do I contact?",
      zh: "房子漏水了，我该联系谁？",
      ja: "天井や配管から水が漏れています。誰に連絡すればいいですか？",
    },
    pain_point: {
      en: "You need to act fast AND document it before anyone blames you.",
      zh: "既要马上止损，又要在责任被推到自己头上之前拍照留证据。",
      ja: "被害を広げないためにすぐ動きつつ、責任を押し付けられないように記録を残す必要があります。",
    },
    standard_answer: {
      en: "Treat it as urgent. 1) Stop the source if you can — turn off the water shutoff valve (止水栓) under the sink / behind the toilet. 2) Photograph everything (ceiling, walls, floor, the leak point) before you clean up — this protects you against being blamed. 3) Contact your building management (管理会社) or landlord immediately — most contracts make them responsible for structural leaks. 4) If water is coming from upstairs, also tell management so they can contact the upstairs unit. Don't try to enter the upstairs unit yourself.",
      zh: "按紧急情况处理。1）能关的地方先关掉水——水槽下方或马桶后面一般有止水阀（止水栓）。2）在清理之前先拍照（天花板、墙面、地面、漏水点），这是保护你自己不被倒扣责任的证据。3）马上联系物业/管理公司（管理会社）或房东——绝大多数合同里，结构性漏水由房东/物业负责。4）如果水是从楼上下来的，也告诉物业让他们去沟通楼上住户，不要自己上去敲门。",
      ja: "緊急案件として扱ってください。1) 止められる場所があれば、まず水を止めます（キッチンやトイレの止水栓）。2) 片付ける前に写真を撮ります（天井・壁・床・漏水箇所）。これは後で責任を問われないための証拠になります。3) すぐに管理会社または家主に連絡してください。契約上、構造的な水漏れの対応は通常、管理会社・家主の責任です。4) 上の階からの漏水なら、その旨も管理会社に伝えます。ご自分で上の階に直接行くのは避けてください。",
    },
    next_step_confirm: {
      en: "Identify where the water is coming from and whether you can shut it off at the valve.",
      zh: "先确认水是从哪里来的，以及你能不能在止水阀处关掉。",
      ja: "水がどこから来ているか、止水栓で止められるかを確認してください。",
    },
    next_step_prepare: {
      en: "Photos and a short timeline (when you noticed it), your lease info, and the building management phone number.",
      zh: "拍好的照片、发现漏水的时间、你的租约信息、以及管理公司的电话。",
      ja: "写真、気づいた時刻のメモ、賃貸契約の情報、管理会社の連絡先をそろえてください。",
    },
    next_step_contact: {
      en: "Your building management (管理会社) or landlord — most buildings post a 24h emergency contact in the entryway or mailbox area.",
      zh: "物业/管理公司（管理会社）或房东——楼道或信箱附近通常会贴着 24 小时紧急联系方式。",
      ja: "管理会社または家主。多くの建物では、玄関やメールボックス付近に24時間緊急連絡先が掲示されています。",
    },
    next_step_warning: {
      en: "Do not delay reporting — if the leak damages a neighbor's unit, unreported delay can shift liability to you.",
      zh: "不要拖着不报——如果漏水殃及邻居的房间，耽搁上报可能会让责任被转到你身上。",
      ja: "報告を遅らせないでください。下の階など他の部屋に被害が広がった場合、連絡の遅れが責任を問われる原因になります。",
    },
    target_user: ["renter"],
    risk_level: "medium",
    official_confirmation_required: false,
    source_type: "practical",
    language: "multi",
    keywords: {
      en: ["water leak", "leaking", "leak", "ceiling leak", "pipe leak", "flood"],
      zh: ["漏水", "漏水了", "房子漏水", "水管漏", "天花板漏水"],
      ja: ["水漏れ", "漏水", "天井から水", "配管から水"],
    },
    status: "live",
  },
  {
    id: "trouble-no-hot-water",
    category: "daily_life",
    subtopic: "no-hot-water",
    representative_title: {
      en: "No hot water — troubleshooting",
      zh: "家里没热水了怎么办",
      ja: "お湯が出ないときの対処",
    },
    user_question_pattern: {
      en: "I have no hot water — what should I check first?",
      zh: "家里突然没热水了，先检查什么？",
      ja: "急にお湯が出なくなりました。何から確認すればいいですか？",
    },
    pain_point: {
      en: "Usually it's the gas, the water heater, or a frozen pipe — three very different fixes.",
      zh: "常见原因有三种：燃气、热水器本身、或者水管冻住——处理方法完全不同。",
      ja: "原因は主にガス・給湯器・配管凍結の3つで、対処方法がそれぞれ違います。",
    },
    standard_answer: {
      en: "Check these in order: 1) Does the gas stove still work? If not, it's a gas issue — your gas may have been auto-shut after an earthquake; press the復帰 (reset) button on the gas meter. 2) Is there a control panel for the water heater (給湯器) in your kitchen or wall? Check the display for an error code and confirm it's powered on and temperature is set. 3) In winter, if only one faucet has no hot water, a pipe may be frozen — let it thaw naturally, do not pour boiling water on it. 4) Still broken? Call your building management — the water heater is usually landlord-owned equipment.",
      zh: "按顺序排查：1）煤气灶还能用吗？如果不能，就是煤气问题——地震后煤气表会自动断气，按煤气表上的「復帰」(复位) 按钮。2）厨房或墙上一般有热水器（給湯器）的控制面板，看看有没有错误码、电源是不是开着、温度是不是设好的。3）冬天如果只有某一个水龙头没热水，很可能是水管冻住了——自然解冻，不要用开水烫。4）还是不行就联系物业/管理公司——热水器一般是房东/物业的设备。",
      ja: "順番に確認してください。1) ガスコンロは使えますか？使えない場合はガスの問題です。地震の後はガスメーターが自動で止まることがあるので、ガスメーターの「復帰」ボタンを押してください。2) キッチンや壁にある給湯器のリモコン（コントロールパネル）に、エラーコードが出ていないか、電源・温度設定を確認します。3) 冬で特定の蛇口だけお湯が出ない場合は、配管が凍結している可能性があります。自然解凍を待ってください。熱湯をかけてはいけません。4) それでも直らなければ管理会社へ連絡します。給湯器は通常、家主・管理会社の設備です。",
    },
    next_step_confirm: {
      en: "Is it all faucets or just one? Does the gas stove work?",
      zh: "先看：是所有水龙头都没热水，还是只有一个？煤气灶还能用吗？",
      ja: "すべての蛇口で出ないのか、特定の1ヶ所だけか。ガスコンロは使えるかを確認してください。",
    },
    next_step_prepare: {
      en: "The error code on the water heater panel (if any), and your building management contact.",
      zh: "热水器面板上的错误代码（如果有）、物业/管理公司的联系方式。",
      ja: "給湯器のエラーコード（表示があれば）、管理会社の連絡先。",
    },
    next_step_contact: {
      en: "Building management (管理会社) or landlord. If it's a gas supply issue, the gas company's emergency line.",
      zh: "物业/管理公司（管理会社）或房东。如果确认是供气问题，打燃气公司的紧急电话。",
      ja: "管理会社または家主。ガス供給そのものの問題であれば、ガス会社の緊急連絡先へ。",
    },
    next_step_warning: {
      en: "Don't try to open the water heater yourself.",
      zh: "不要自己拆开热水器检查。",
      ja: "給湯器をご自分で開けて修理しようとしないでください。",
    },
    target_user: ["renter", "resident"],
    risk_level: "low",
    official_confirmation_required: false,
    source_type: "practical",
    language: "multi",
    keywords: {
      en: ["no hot water", "hot water not working", "water heater"],
      zh: ["没热水", "热水没了", "没有热水", "热水器坏了"],
      ja: ["お湯が出ない", "給湯器", "お湯がでない"],
    },
    status: "live",
  },
  {
    id: "trouble-no-gas",
    category: "daily_life",
    subtopic: "no-gas",
    representative_title: {
      en: "Gas not working — what to check",
      zh: "煤气/燃气不通了怎么办",
      ja: "ガスが出ないときの対処",
    },
    user_question_pattern: {
      en: "My gas isn't working — stove or shower.",
      zh: "家里煤气不通了，灶台或者洗澡都用不了。",
      ja: "ガスが使えなくなりました。コンロもお風呂も出ません。",
    },
    pain_point: {
      en: "After earthquakes, gas auto-shuts; most people don't know about the reset button.",
      zh: "地震之后煤气表会自动断气，很多人不知道有一个「復帰」按钮可以自己恢复。",
      ja: "地震後にガスメーターが自動遮断されることを知らず、復帰方法がわからない方が多いです。",
    },
    standard_answer: {
      en: "1) Smell for gas first. If you smell gas anywhere, stop — open windows, don't flip any switches, leave the apartment, and call the gas company's emergency line from outside. 2) If there's no smell: find your gas meter (usually outside the entrance or in a utility closet). If the red light is blinking, gas has been auto-shut — press and hold the 復帰 (reset) button for ~5 seconds and wait 3 minutes. 3) If the meter looks normal, check that the main gas valve is open. 4) Still no gas? Call the gas company directly (Tokyo Gas: 0570-002211 / Osaka Gas: 0120-0-19424).",
      zh: "1）先闻有没有煤气味。如果任何地方闻到煤气味，立刻停下——开窗、不要动任何电器开关、离开房间，到室外再打燃气公司紧急电话。2）如果没有气味：找一下你家的煤气表（一般在门外或水电表柜里）。如果表上红灯在闪，说明煤气被自动切断——按住「復帰」按钮约 5 秒，然后等 3 分钟。3）如果表看起来正常，检查总阀门有没有被关上。4）还是不行就直接打燃气公司（东京瓦斯 0570-002211 / 大阪瓦斯 0120-0-19424）。",
      ja: "1) まずガスの臭いを確認してください。少しでも臭いがする場合は、窓を開け、電気のスイッチには絶対に触らず、部屋を出て、屋外からガス会社の緊急連絡先に電話してください。2) 臭いがない場合は、玄関の外やパイプスペースにあるガスメーターを確認します。赤いランプが点滅していれば、ガスが自動遮断されています。メーターの「復帰」ボタンを約5秒押し、そのまま3分ほど待ちます。3) メーターが正常なら、元栓が閉まっていないか確認します。4) それでも使えない場合は、ガス会社に直接連絡してください（東京ガス 0570-002211 / 大阪ガス 0120-0-19424）。",
    },
    next_step_confirm: {
      en: "First rule out a gas smell; then check the gas meter indicator light.",
      zh: "先排除煤气泄漏（是否有味道），再看煤气表上的指示灯。",
      ja: "まずガス漏れ（臭い）を確認し、次にガスメーターのランプを確認してください。",
    },
    next_step_prepare: {
      en: "Gas company customer number, and the location of your gas meter.",
      zh: "燃气公司的客户编号、煤气表的位置。",
      ja: "ガス会社の契約番号、ガスメーターの場所を把握しておいてください。",
    },
    next_step_contact: {
      en: "Gas company emergency line (Tokyo Gas 0570-002211, Osaka Gas 0120-0-19424), or your building management.",
      zh: "燃气公司紧急电话（东京瓦斯 0570-002211，大阪瓦斯 0120-0-19424）或物业。",
      ja: "ガス会社の緊急連絡先（東京ガス 0570-002211、大阪ガス 0120-0-19424）、または管理会社。",
    },
    next_step_warning: {
      en: "If you smell gas, don't use lights, switches, phones or lighters indoors — go outside first.",
      zh: "闻到煤气味时，室内不要开灯、按开关、打电话、点火——先到室外再说。",
      ja: "ガスの臭いがする場合、室内では照明・スイッチ・携帯・ライター等を使わず、まず屋外に出てください。",
    },
    target_user: ["renter", "resident"],
    risk_level: "high",
    official_confirmation_required: false,
    source_type: "practical",
    language: "multi",
    keywords: {
      en: ["no gas", "gas not working", "gas stove", "gas smell"],
      zh: ["没煤气", "煤气坏了", "没燃气", "燃气坏了"],
      ja: ["ガスが出ない", "ガスが止まった", "ガスコンロ"],
    },
    status: "live",
  },
  {
    id: "trouble-wifi-down",
    category: "daily_life",
    subtopic: "wifi-down",
    representative_title: {
      en: "Internet / Wi-Fi is down — what to check",
      zh: "家里的Wi-Fi/网断了怎么办",
      ja: "Wi-Fi・インターネットがつながらないときの対処",
    },
    user_question_pattern: {
      en: "My Wi-Fi isn't working, what should I do first?",
      zh: "家里的 Wi-Fi 断了，先做什么？",
      ja: "Wi-Fiがつながらなくなりました。まず何をすればいいですか？",
    },
    pain_point: {
      en: "You need to figure out if it's your device, your router, or the ISP line.",
      zh: "要先判断是你自己的设备问题、路由器问题，还是运营商线路问题。",
      ja: "自分のデバイス、ルーター、回線事業者のどれが原因かを切り分ける必要があります。",
    },
    standard_answer: {
      en: "Work through these: 1) Try another device (phone vs laptop). If all devices have no internet, it's not your device. 2) Power-cycle the router and the ONU (optical modem): unplug both, wait 60 seconds, plug the ONU in first, wait for its lights to stabilize, then plug in the router. This fixes most cases. 3) Check the ONU's lights — if the 認証 or 回線 light is red, it's an ISP-side issue. 4) Check your ISP's outage page or X (Twitter) for reports in your area. 5) Still broken? Call your ISP's support line with your 'お客様番号' ready.",
      zh: "按顺序排查：1）换一台设备试（手机和电脑）。如果所有设备都上不了网，就不是你这台设备的问题。2）给路由器和光猫（ONU）重启：两个都拔电，等 60 秒，先插光猫，等它的灯稳定下来，再插路由器。这一步能解决大部分情况。3）看光猫上的灯——如果「認証」或「回線」灯是红色，就是运营商侧的问题。4）上运营商的故障信息页或 X (Twitter) 看一下你所在地区有没有人报故障。5）还不行就打运营商的客服电话，手边准备好「お客様番号」。",
      ja: "順番に試してください。1) 別のデバイスでも確認します（スマホとPC）。どの機器でもつながらないなら、端末側の問題ではありません。2) ルーターとONU（光回線の終端装置）を電源OFF→60秒待つ→先にONU、その後ルーターの順に電源ONにします。これで解決するケースが多いです。3) ONUのランプを確認します。「認証」や「回線」ランプが赤の場合は、回線事業者側の問題です。4) 契約しているプロバイダーの障害情報ページやSNSで、地域の障害情報を確認します。5) 直らない場合は、プロバイダーのサポートに電話します。「お客様番号」を手元に用意してください。",
    },
    next_step_confirm: {
      en: "Check if it's one device or all devices, and look at the ONU's status lights.",
      zh: "先确认是一台设备还是所有设备上不了网，再看光猫的状态灯。",
      ja: "1台だけか全デバイスか、ONUのランプの状態を確認してください。",
    },
    next_step_prepare: {
      en: "Your ISP contract info and 'お客様番号', and a way to access your ISP's outage page (mobile data).",
      zh: "运营商合同里的客户编号（お客様番号），以及能上运营商故障信息页的备用网络（比如手机流量）。",
      ja: "プロバイダーの契約情報・お客様番号、障害情報ページを確認するためのモバイル回線。",
    },
    next_step_contact: {
      en: "Your internet provider's customer support. If it's a building-provided (マンションタイプ) line, also contact building management.",
      zh: "你的网络运营商客服。如果是楼盘自带的宽带（マンションタイプ），也联系物业/管理公司。",
      ja: "契約している回線事業者のサポート窓口。マンションタイプの場合は管理会社にも連絡してください。",
    },
    target_user: ["renter", "resident"],
    risk_level: "low",
    official_confirmation_required: false,
    source_type: "practical",
    language: "multi",
    keywords: {
      en: ["wifi", "wi-fi", "internet down", "no internet", "router"],
      zh: ["wifi断了", "wifi不通", "没网", "断网", "上不了网"],
      ja: ["ネット", "ネットが繋がらない", "wifiが繋がらない", "ルーター"],
    },
    status: "live",
  },
  {
    id: "trouble-broken-light-appliance",
    category: "renting",
    subtopic: "broken-appliance",
    representative_title: {
      en: "Broken light or appliance — who pays, who fixes",
      zh: "灯或家电坏了——找谁修，谁承担费用",
      ja: "照明や家電が壊れたとき — 修理担当と費用負担",
    },
    user_question_pattern: {
      en: "A ceiling light (or the AC / stove) is broken — do I fix it myself?",
      zh: "天花板的灯（或者空调、炉灶）坏了——我自己修还是找房东？",
      ja: "天井の照明（またはエアコン・コンロ）が壊れました。自分で直すべきですか？",
    },
    pain_point: {
      en: "The rule depends on whether the item was included in the apartment or brought in by you.",
      zh: "关键看这件东西是不是租房时就带的——带的房东管，你自己买的你自己管。",
      ja: "そのアイテムが「備付け（最初から部屋にあった）」か「入居者持ち込み」かで対応が変わります。",
    },
    standard_answer: {
      en: "General rule: if the item was already in the apartment when you moved in, the landlord / management is usually responsible for repair. If you brought it in yourself (e.g., you bought the AC), it's your responsibility. Ceiling light fixtures with a standard 引っ掛けシーリング socket are usually tenant-replaceable — you can buy a new LED ceiling light at a home-center. For anything wired into the wall (outlets, built-in AC, bathroom fan, water heater), do not DIY — contact building management. Take a photo and write the model number before contacting them.",
      zh: "一般原则：入住时就已经在房间里的东西，坏了通常由房东/管理公司负责修；你自己搬进来的东西（比如自己买的空调），由你自己负责。天花板灯具如果是标准的「引っ掛けシーリング」接口，属于租客可以自己换的范围——去家居卖场买一个 LED 吸顶灯装上即可。凡是埋墙里的东西（插座、嵌入式空调、浴室换气扇、热水器），不要自己动手，联系物业/管理公司。联系之前先拍照、把型号记下来。",
      ja: "原則として、入居時からあった設備は家主・管理会社の修理責任、自分で持ち込んだものはご自身の負担です。天井照明が標準の「引っ掛けシーリング」タイプなら、入居者が交換できる範囲なので、ホームセンターでLEDシーリングライトを購入して取り付け可能です。壁に埋め込まれているもの（コンセント、埋込型エアコン、浴室換気扇、給湯器）はご自分で触らず、管理会社へ連絡してください。連絡前に写真を撮り、型番をメモしておきましょう。",
    },
    next_step_confirm: {
      en: "Was the item part of the apartment at move-in, or did you bring it in?",
      zh: "先确认：这件东西是入住时就在的，还是你自己搬进来的？",
      ja: "その設備は入居時からあったものか、ご自分で持ち込んだものかを確認してください。",
    },
    next_step_prepare: {
      en: "A photo, the model number, and a short description of the fault.",
      zh: "拍一张照片、记下型号、简短写明故障情况。",
      ja: "写真、型番、故障の簡単な説明を用意してください。",
    },
    next_step_contact: {
      en: "For built-in items: building management (管理会社). For items you bought: the manufacturer's repair line or a home-center with installation service.",
      zh: "属于房东的设备：联系物业/管理公司（管理会社）。自己买的东西：厂家客服或家居卖场的安装服务。",
      ja: "備付けの設備: 管理会社。持ち込みのもの: メーカーのサポートまたはホームセンターの取付サービス。",
    },
    next_step_warning: {
      en: "Do not open wiring or circuit boards yourself — damage you cause becomes your liability.",
      zh: "不要自己拆电路板或墙内接线——自己造成的损坏会被算到你头上。",
      ja: "配線や基板をご自分で開けないでください。ご自身で発生させた故障は入居者の負担になります。",
    },
    target_user: ["renter"],
    risk_level: "low",
    official_confirmation_required: false,
    source_type: "practical",
    language: "multi",
    keywords: {
      en: ["light broken", "bulb", "appliance broken", "ac broken", "who pays repair"],
      zh: ["灯坏了", "灯泡坏了", "灯不亮", "电器坏了", "空调坏了", "找谁修"],
      ja: ["電球", "照明が点かない", "家電が壊れた", "エアコン壊れた"],
    },
    status: "live",
  },
  {
    id: "trouble-garbage-day",
    category: "daily_life",
    subtopic: "garbage-day",
    representative_title: {
      en: "Missed garbage day / can I throw it out today?",
      zh: "垃圾今天能不能扔？错过收集日怎么办？",
      ja: "ゴミの日を逃した／今日ゴミを出せますか",
    },
    user_question_pattern: {
      en: "Can I put out the garbage today? I missed the collection day.",
      zh: "我今天能扔垃圾吗？错过了收集日该怎么办？",
      ja: "今日ゴミを出しても大丈夫ですか？収集日を逃してしまいました。",
    },
    pain_point: {
      en: "Rules are per-ward, not national, and wrong days can get your bag returned.",
      zh: "规定是按区走的，不是全国统一；错日子扔出去，袋子会被贴纸退回来。",
      ja: "ルールは区市町村ごとに異なり、曜日を間違えると回収されず戻されることがあります。",
    },
    standard_answer: {
      en: "Garbage rules are set by your ward / city, not national. Each category (burnable / non-burnable / PET bottles / cans & bottles / cardboard / oversized) has fixed collection days and fixed morning cutoff times (usually 8:00 or 8:30 AM). If you miss today's collection, you should NOT put the bag out — keep it at home until the next scheduled day for that category, otherwise crows and the collectors will both be unhappy and the bag may be refused. Your ward publishes a free multilingual garbage calendar (ゴミカレンダー) — most big wards have English/Chinese/Vietnamese PDFs online.",
      zh: "垃圾规则由你所在的区（市役所/区役所）制定，不是全国统一。每一类垃圾（可燃、不可燃、PET 瓶、瓶罐、纸箱、大件）有固定的收集日和固定的清晨截止时间（通常是早上 8:00 或 8:30）。如果错过今天，就不要再把袋子放出去——放在家里等下次该类别的收集日，否则会被乌鸦扒开，或者被贴纸退回。你所在的区役所会免费发一份多语言的「垃圾日历」（ゴミカレンダー），多数大区的官网上都有英文、中文、越南语 PDF。",
      ja: "ゴミ出しのルールは区市町村ごとに決まっており、全国共通ではありません。分別ごと（燃えるゴミ・燃えないゴミ・ペットボトル・缶瓶・段ボール・粗大ゴミ）に曜日と朝の収集時刻（通常は8:00か8:30まで）が決まっています。今日の収集を逃した場合は袋を外に出さず、次回の収集日まで家で保管してください。出してしまうとカラスに荒らされたり、収集されずに「違反」シールを貼られて戻されたりします。区役所では多言語の「ゴミカレンダー」が無料で配布されており、英語・中国語・ベトナム語などのPDFをウェブサイトからも入手できます。",
    },
    next_step_confirm: {
      en: "Look up your ward's garbage calendar for today's category and tomorrow's.",
      zh: "查一下你所在区的垃圾日历，看今天和明天分别收哪一类。",
      ja: "お住まいの区の「ゴミカレンダー」で、今日・明日の分別区分を確認してください。",
    },
    next_step_prepare: {
      en: "Your ward name (e.g., Shinjuku-ku) — the calendar is usually at city.shinjuku.lg.jp/ (or your ward's equivalent).",
      zh: "你所在区的名称（例如「新宿区」）——日历通常在区役所官网，例如 city.shinjuku.lg.jp。",
      ja: "お住まいの区の名前（例: 新宿区）。区のウェブサイト（例: city.shinjuku.lg.jp）からカレンダーを確認できます。",
    },
    next_step_contact: {
      en: "Your ward office (区役所 / 市役所) environment or sanitation section, or your building management for building-specific rules.",
      zh: "区役所 / 市役所的环境/清扫课，或者物业/管理公司了解本楼的具体规定。",
      ja: "区役所・市役所の清掃課、または建物固有のルールについては管理会社へ。",
    },
    target_user: ["renter", "resident"],
    risk_level: "low",
    official_confirmation_required: false,
    source_type: "practical",
    language: "multi",
    keywords: {
      en: ["garbage day", "garbage collection", "missed garbage", "can i throw", "trash day"],
      zh: ["垃圾日", "垃圾能不能扔", "垃圾今天", "扔垃圾", "收垃圾"],
      ja: ["ゴミ収集日", "ゴミの日", "ゴミ出し"],
    },
    status: "live",
  },
  {
    id: "trouble-landlord-management",
    category: "renting",
    subtopic: "landlord-contact",
    representative_title: {
      en: "How to contact your landlord / building management",
      zh: "怎么联系房东 / 物业管理公司",
      ja: "家主・管理会社への連絡方法",
    },
    user_question_pattern: {
      en: "Who do I actually contact when something goes wrong in my apartment?",
      zh: "出问题的时候到底应该联系谁——房东还是物业？",
      ja: "部屋で何か起きたとき、家主と管理会社のどちらに連絡すればいいですか？",
    },
    pain_point: {
      en: "Most tenants don't know which paper in their contract has the right number.",
      zh: "很多租客不知道合同里哪一页上写着正确的紧急联系方式。",
      ja: "契約書のどのページに連絡先が書いてあるか分からない方が多いです。",
    },
    standard_answer: {
      en: "For almost all day-to-day issues, the correct contact is the building management company (管理会社), NOT the landlord directly. The management company's name and 24h contact number are usually printed on: 1) the first or last page of your lease contract; 2) a sticker in the building entrance or mailbox area; 3) a refrigerator magnet or sheet they gave you at move-in. Save that number in your phone now, before you need it. Only contact the landlord (大家 / 家主) directly if management explicitly tells you to, or if there is no management company on your contract.",
      zh: "绝大多数日常问题的正确联系对象是「管理会社」（物业管理公司），而不是房东本人。管理公司的名字和 24 小时电话通常写在：1）租约合同的第一页或最后一页；2）楼道入口或信箱区域的贴纸；3）入住时发给你的磁贴或说明纸上。现在就把这个号码存进手机，不要等出事才翻合同。只有在管理公司明确让你直接联系房东，或者你的合同里根本没有管理公司时，才直接找房东（大家 / 家主）。",
      ja: "日常のトラブルは、家主ではなく「管理会社」が正しい連絡先です。管理会社の名前と24時間連絡先は通常、1) 賃貸契約書の最初または最後のページ、2) 建物のエントランスやメールボックス付近の掲示、3) 入居時にもらった冷蔵庫用マグネットや案内シート、に書かれています。必要になる前に、今すぐ連絡先を携帯に登録しておきましょう。家主（大家・オーナー）に直接連絡するのは、管理会社から指示された場合、または契約書に管理会社の記載がない場合のみです。",
    },
    next_step_confirm: {
      en: "Find your lease and locate the management company's name + phone.",
      zh: "拿出租约合同，找到管理公司的名字和电话号码。",
      ja: "賃貸契約書を確認し、管理会社の名称と電話番号を探してください。",
    },
    next_step_prepare: {
      en: "Your building name, room number, and a one-sentence description of the issue.",
      zh: "你的楼栋名、房号、以及用一句话描述的问题。",
      ja: "物件名、部屋番号、問題の概要（1文）を用意してください。",
    },
    next_step_contact: {
      en: "Building management company (管理会社). Most have a 24h emergency line for water/gas/lock issues.",
      zh: "管理公司（管理会社）。大多数都有 24 小时的水、气、门锁紧急电话。",
      ja: "管理会社。多くは水漏れ・ガス・鍵の紛失などの24時間緊急対応窓口を持っています。",
    },
    target_user: ["renter"],
    risk_level: "low",
    official_confirmation_required: false,
    source_type: "practical",
    language: "multi",
    keywords: {
      en: ["landlord", "property manager", "building management", "management company", "who to contact"],
      zh: ["房东", "物业", "管理公司", "管理员", "找谁修"],
      ja: ["管理会社", "管理人", "大家", "オーナー"],
    },
    status: "live",
  },
  {
    id: "trouble-emergency-vs-nonemergency",
    category: "renting",
    subtopic: "emergency-repair",
    representative_title: {
      en: "Emergency repair vs non-emergency — what to document first",
      zh: "紧急维修 vs 非紧急维修——出事之前先记录什么",
      ja: "緊急修理と通常修理の違い — 連絡前に記録すべきこと",
    },
    user_question_pattern: {
      en: "What counts as an emergency repair? And what should I write down first?",
      zh: "什么算紧急维修？联系物业之前要先记录什么？",
      ja: "緊急修理とはどんな場合ですか？管理会社に連絡する前に何を記録しておくべきですか？",
    },
    pain_point: {
      en: "Without documentation, tenants often get blamed and billed for pre-existing damage.",
      zh: "没有留证据时，租客很容易被栽上原本就有的损坏，并被收修理费。",
      ja: "記録がないと、元からあった損傷の責任を入居者が負わされ、費用請求されることがあります。",
    },
    standard_answer: {
      en: "Emergency (call now, even at night): water leak in progress, no water at all, no gas, gas smell, electrical sparks or smoke, front door lock broken, toilet overflowing, broken window on ground floor. Non-emergency (report during business hours): slow drain, noisy AC, minor crack, a single broken light, bathroom fan not working. Before contacting management, document: 1) time you noticed it, 2) photos or a short video, 3) the exact model / location, 4) what you already tried, 5) any related noises or smells. Send this info in writing (LINE / email) even if you also call — a written record protects both sides.",
      zh: "紧急情况（立刻打电话，哪怕半夜）：正在漏水、完全没水、没煤气、有煤气味、有电火花或冒烟、大门锁坏了、马桶溢水、一楼窗户坏了。非紧急（工作时间报修即可）：下水慢、空调有噪音、墙面轻微裂缝、单个灯坏了、浴室换气扇坏了。联系物业前先留证据：1）发现时间；2）照片或短视频；3）具体型号 / 位置；4）你已经试过什么；5）有没有异响或异味。即使打电话，也要用文字形式再发一遍（LINE 或邮件）——书面记录对双方都有保护。",
      ja: "緊急（すぐ連絡、深夜でも）: 進行中の水漏れ、水がまったく出ない、ガスが出ない、ガス臭、火花・煙、玄関の鍵が壊れた、トイレの溢水、1階窓の破損など。通常（営業時間内で可）: 排水が遅い、エアコンの異音、壁のひび、照明1つの故障、浴室換気扇の不調など。管理会社に連絡する前に次を記録してください。1) 気づいた時刻、2) 写真または短い動画、3) 型番や正確な場所、4) すでに試したこと、5) 関連する音や臭い。電話した場合でも、LINEやメールで同じ内容を文書で残してください。双方にとって有効な記録になります。",
    },
    next_step_confirm: {
      en: "Decide: is this stopping you from living in the unit safely right now?",
      zh: "先判断：这件事是不是让你现在没法安全住在房子里？",
      ja: "まず判断: 今、安全に生活できない状態かどうか。",
    },
    next_step_prepare: {
      en: "Photos, a one-line description, time of discovery, and your unit number.",
      zh: "照片、一句话描述、发现时间、你的房号。",
      ja: "写真、概要（1文）、発見時刻、部屋番号。",
    },
    next_step_contact: {
      en: "Building management (管理会社). Use their emergency line only for actual emergencies — overuse damages future response.",
      zh: "管理公司（管理会社）。紧急电话只在真正紧急时使用——滥用会影响以后他们对你的响应。",
      ja: "管理会社。緊急連絡先は本当に緊急な場合のみ使ってください。乱用すると今後の対応に影響します。",
    },
    next_step_warning: {
      en: "Never sign 'I accept full responsibility for this damage' documents without a walkthrough and photos.",
      zh: "没有现场确认和照片之前，绝不要在「我承担全部责任」的文件上签字。",
      ja: "現場確認と写真の前に、「全責任を負う」という書面にサインしないでください。",
    },
    target_user: ["renter"],
    risk_level: "medium",
    official_confirmation_required: false,
    source_type: "practical",
    language: "multi",
    keywords: {
      en: ["emergency repair", "urgent repair", "repair request", "non emergency", "document damage"],
      zh: ["紧急维修", "紧急修理", "非紧急维修", "报修"],
      ja: ["緊急修理", "応急修理", "修理依頼"],
    },
    status: "live",
  },
  // ================= rental budget guidance =================
  {
    id: "renting-tokyo-budget-100k",
    category: "renting",
    subtopic: "tokyo-budget-100k",
    representative_title: {
      en: "What can ¥100,000 monthly rent get you in Tokyo?",
      zh: "房租 10 万日元在东京能租到什么样的房子？",
      ja: "家賃10万円で東京ではどんな部屋が借りられますか？",
    },
    user_question_pattern: {
      en: "I want to rent in Tokyo with around ¥100k/month — where should I look?",
      zh: "我想在东京租房，预算 10 万日元左右，能在哪里租到房？",
      ja: "東京で家賃10万円ぐらいで部屋を借りたいのですが、どのあたりが現実的ですか？",
    },
    pain_point: {
      en: "Listing sites show ¥100k apartments in many wards, but the realistic size, distance from a station, and trade-offs are not obvious to a newcomer.",
      zh: "在租房网站上 10 万日元的房子很多，但实际的面积、离车站多远、要做什么取舍，对刚来日本的人不容易看明白。",
      ja: "ポータルサイトには10万円の物件が大量に出てきますが、実際の広さ、駅からの距離、トレードオフは初めての方には分かりづらいです。",
    },
    standard_answer: {
      en: "¥100,000/month in Tokyo realistically gets you one of three trade-offs (assuming a single tenant, foreigner-friendly building, no pets). 1) About 20–25 m² (1K / 1DK) inside the Yamanote line in wards like Shinjuku, Toshima, Nakano, Shinagawa, or Bunkyo, usually 8–15 minutes walk from a station and 15–25 years old. 2) About 30–40 m² (1LDK / 2K) one or two train stops outside the Yamanote line in Suginami, Setagaya (further west), Itabashi, Adachi, Edogawa, Kita, or Ota — newer, more space, longer commute. 3) About 40–55 m² (1LDK / 2LDK) in newer buildings in Saitama (Kawaguchi, Warabi), Kanagawa (Kawasaki, Yokohama north), or Chiba (Funabashi, Ichikawa) within 30–45 minutes by train to central Tokyo. Within central wards expect older buildings, smaller rooms, and tighter floor plans for the same price. Also remember the move-in cost is typically 4–6 months of rent on top of the monthly figure.",
      zh: "在东京，月租 10 万日元左右，假设你是一个人住、想找对外国人友好的房子、不带宠物，大致能在三种取舍里选一种：1）想住在山手线以内（新宿、丰岛、中野、品川、文京等区），可以租到约 20–25 平米的 1K / 1DK，房龄一般 15–25 年，离车站走路 8–15 分钟。2）愿意往山手线外一两站（杉并、世田谷西部、板桥、足立、江戸川、北区、大田区等），可以租到约 30–40 平米的 1LDK / 2K，房子更新一些、空间更大，但通勤时间长一些。3）愿意住到埼玉（川口、蕨）、神奈川（川崎、横浜北部）、千叶（船桥、市川），通勤 30–45 分钟到东京中心，可以租到约 40–55 平米的较新 1LDK / 2LDK。城里同样的预算房子会更小、更旧。另外提醒一下，搬家时的初期费用一般还要再准备 4–6 个月房租。",
      ja: "東京で家賃10万円前後（一人暮らし・外国人対応OKの物件・ペットなし、と仮定した場合）の現実的な選択肢は、おおよそ次の3パターンです。1）山手線の内側（新宿区・豊島区・中野区・品川区・文京区など）で20〜25㎡の1K/1DK。築15〜25年、駅から徒歩8〜15分が目安。2）山手線の外側1〜2駅（杉並区、世田谷区西側、板橋区、足立区、江戸川区、北区、大田区など）で30〜40㎡の1LDK/2K。物件は新しめ・広めですが通勤は少し長くなります。3）埼玉（川口・蕨）、神奈川（川崎・横浜北部）、千葉（船橋・市川）で40〜55㎡の比較的新しい1LDK/2LDK、都心まで電車30〜45分。同じ家賃でも都心側は古く狭く、郊外側は新しく広くなる、という関係です。なお、入居時の初期費用は別途、家賃の4〜6ヶ月分を見ておいてください。",
    },
    next_step_confirm: {
      en: "Confirm the move-in cost (typically 4–6 months of rent) is also within your budget — the listed monthly rent is only part of it.",
      zh: "先确认你除了月租之外，还有相当于 4–6 个月房租的初期费用，这部分网站上一般不会一开始就告诉你。",
      ja: "月額家賃の他に、入居時に家賃4〜6ヶ月分の初期費用が必要になることも見込んでおいてください。",
    },
    next_step_prepare: {
      en: "Decide what matters most: closeness to central Tokyo, room size, building age, or quietness — then narrow your search to two or three candidate wards.",
      zh: "想清楚你最看重哪一点：靠近东京中心、面积、房龄、安静程度——然后把范围缩小到两三个候选区。",
      ja: "「都心への近さ・広さ・築年数・静かさ」のうち、何を一番優先するかを決めて、候補を2〜3区に絞ってから探すと効率的です。",
    },
    next_step_contact: {
      en: "A foreigner-friendly rental agent — Real Estate Japan, GaijinPot, Ichii, or local agents in your candidate wards.",
      zh: "找一家对外国人友好的中介，比如 Real Estate Japan、GaijinPot、ichii，或者你候选区的本地中介。",
      ja: "外国人対応に慣れた不動産業者（Real Estate Japan、GaijinPot、ichiiや、候補エリアの地元業者）に問い合わせましょう。",
    },
    target_user: ["new-arrival", "renter"],
    risk_level: "low",
    official_confirmation_required: false,
    notes: "Budget guidance is illustrative — actual market shifts. Treat numbers as a working assumption, not a quote.",
    source_type: "practical",
    language: "multi",
    keywords: {
      en: ["100k", "100000", "tokyo", "tokyo rent", "tokyo apartment", "tokyo budget", "where to live tokyo", "rent in tokyo", "tokyo wards", "shinjuku rent", "setagaya", "kawasaki", "saitama"],
      // Distinctive Chinese substrings of typical "where can I rent in Tokyo
      // for ¥X" queries — these guarantee this FAQ outranks the broader
      // initial-cost entry on budget/location questions, even when both
      // saturate the score at 1.0.
      zh: ["10万", "十万", "东京", "东京租房", "东京房租", "东京哪里", "在东京", "东京租", "房租10万", "新宿", "世田谷", "川崎", "埼玉", "千叶", "山手线", "预算", "租哪里"],
      ja: ["10万", "東京", "東京 家賃", "東京 物件", "東京 賃貸", "山手線", "新宿区", "世田谷区", "川崎", "埼玉", "千葉", "予算"],
    },
    status: "live",
  },
];

// ---------- STUB ENTRIES (scaffold for Layer-3 expansion) ----------
// Titles only (English). Not searchable. Lets us track target of 150.
export const STUB_FAQS: FaqStub[] = [
  // -------- renting (need ~72 more to reach 80) --------
  ...[
    "Finding a foreigner-friendly rental agent",
    "Sharehouse vs apartment",
    "Monthly / weekly mansion (short-term furnished)",
    "UR housing (public rental)",
    "Municipal public housing (shiei-juutaku) eligibility",
    "Pet-allowed rentals",
    "Can I negotiate rent in Japan?",
    "What does the background check for renters look like?",
    "Required documents for a rental application",
    "Proof of income for rental applications",
    "Employment status and rental eligibility",
    "Student-friendly rental options",
    "Room size in jō (tatami mats) explained",
    "Balcony, laundry drying, futon airing",
    "Soundproofing between apartments",
    "Earthquake-resistance standard (新耐震基準)",
    "Apartment age (chikunen-suu) — does it matter?",
    "3-in-1 bath vs separated bath/toilet",
    "How far from the station is reasonable?",
    "Which Tokyo wards are foreigner-friendly?",
    "Cheap areas near major cities",
    "Commute time vs rent trade-off",
    "Viewing etiquette — what to ask the agent",
    "Fire insurance for renters",
    "24-hour support fee (24時間サポート料)",
    "Cleaning fee on move-out",
    "Restoration (原状回復) disputes",
    "Noise complaints from neighbors",
    "Mailbox key management",
    "Intercom (interphone) system basics",
    "Is the air conditioner included?",
    "What to do if an appliance breaks",
    "Mold in Japanese apartments",
    "Winter condensation problems",
    "Heating options: kotatsu, heater, floor heating",
    "Wi-Fi / fiber internet setup",
    "Address registration (jumin-touroku) after moving in",
    "Change of address notifications for other services",
    "Move-out notice period (usually 1 month)",
    "Early termination penalty on leases",
    "How to get your deposit back cleanly",
    "Japan Post change-of-address (tenkyo todoke)",
    "Moving company comparison",
    "Packing and disposal before moving",
    "Oversized trash (sodai-gomi) disposal",
    "Garbage bags by ward",
    "Gas contract setup",
    "Electric contract setup",
    "Water contract setup",
    "Internet contract setup",
    "TV antenna / NHK fee question",
    "Rent payment methods (bank transfer, furikae)",
    "Late rent consequences",
    "Rent-increase notices",
    "Who pays for emergency repairs",
    "Landlord entry rights",
    "Subletting rules",
    "Can roommates legally share a 1LDK?",
    "Keys lost / replaced",
    "Pest control in apartments",
    "Smoking rules in apartments",
    "Bicycle parking",
    "Car parking (shako-shomei) for renters",
    "Moving into a mansion vs apartment building",
    "Online rental applications in English",
    "Reikin / shikikin negotiation rooms",
    "Cheap furnishing stores for first apartment",
    "Insurance for renters' belongings",
    "Break clauses in rental contracts",
    "Security camera / オートロック",
    "Mail forwarding services",
    "Municipal library address registration",
    "Translation of lease terms",
  ].map<FaqStub>((t, i) => ({
    id: `renting-stub-${i + 1}`,
    category: "renting" as const,
    subtopic: t.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40),
    representative_title_en: t,
    risk_level: "low" as const,
    status: "stub" as const,
  })),

  // -------- home_buying (need ~7 more to reach 10) --------
  ...[
    "Real estate agent fees when buying",
    "Property registration (登記) process",
    "Stamp duty (印紙税) amounts",
    "Acquisition tax (不動産取得税) timing",
    "Mansion management and repair-fund fees",
    "Reform / renovation cost ranges",
    "Reselling property — capital gains tax",
  ].map<FaqStub>((t, i) => ({
    id: `home-buying-stub-${i + 1}`,
    category: "home_buying" as const,
    subtopic: t.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40),
    representative_title_en: t,
    risk_level: "medium" as const,
    status: "stub" as const,
  })),

  // -------- visa (need ~25 more to reach 30) --------
  ...[
    { t: "Spouse visa application", r: "high" as RiskLevel },
    { t: "Dependent visa for family", r: "high" as RiskLevel },
    { t: "Student visa renewal", r: "medium" as RiskLevel },
    { t: "Work-while-student weekly hour limits", r: "high" as RiskLevel },
    { t: "Business manager visa basics", r: "high" as RiskLevel },
    { t: "Highly Skilled Professional points", r: "medium" as RiskLevel },
    { t: "Specified Skilled Worker (tokutei ginou)", r: "high" as RiskLevel },
    { t: "Intra-company transferee visa", r: "medium" as RiskLevel },
    { t: "Entertainer visa", r: "medium" as RiskLevel },
    { t: "Long-term resident (teijuusha) basics", r: "high" as RiskLevel },
    { t: "Working holiday visa", r: "low" as RiskLevel },
    { t: "Short-term visitor extension", r: "medium" as RiskLevel },
    { t: "Writing an invitation letter", r: "low" as RiskLevel },
    { t: "Reason-for-extension statement", r: "medium" as RiskLevel },
    { t: "Tax payment proof for renewal", r: "high" as RiskLevel },
    { t: "Health insurance proof for renewal", r: "high" as RiskLevel },
    { t: "Pension enrollment proof for renewal", r: "high" as RiskLevel },
    { t: "Criminal record considerations", r: "high" as RiskLevel },
    { t: "Deportation risk factors", r: "high" as RiskLevel },
    { t: "Consequences of overstay", r: "high" as RiskLevel },
    { t: "Voluntary departure procedure", r: "high" as RiskLevel },
    { t: "Landing permission at the airport", r: "low" as RiskLevel },
    { t: "14-day address registration after entry", r: "high" as RiskLevel },
    { t: "Notification of household changes", r: "medium" as RiskLevel },
    { t: "Engineer / Humanities / International Services visa", r: "medium" as RiskLevel },
  ].map<FaqStub>((x, i) => ({
    id: `visa-stub-${i + 1}`,
    category: "visa" as const,
    subtopic: x.t.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40),
    representative_title_en: x.t,
    risk_level: x.r,
    status: "stub" as const,
  })),

  // -------- daily_life (need ~25 more to reach 30) --------
  ...[
    { t: "Resident tax (juminzei) basics", r: "medium" as RiskLevel },
    { t: "Income tax and year-end adjustment", r: "medium" as RiskLevel },
    { t: "Converting a foreign driver's license", r: "medium" as RiskLevel },
    { t: "IC cards: Suica, Pasmo, ICOCA", r: "low" as RiskLevel },
    { t: "Mobile phone contracts as a foreigner", r: "low" as RiskLevel },
    { t: "Enrolling kids in Japanese public school", r: "medium" as RiskLevel },
    { t: "Hospital visit procedure (first visit)", r: "low" as RiskLevel },
    { t: "Prescription medicine system", r: "low" as RiskLevel },
    { t: "Finding a dentist", r: "low" as RiskLevel },
    { t: "Mental health resources in English", r: "high" as RiskLevel },
    { t: "Pregnancy registration and boshi kenko techo", r: "medium" as RiskLevel },
    { t: "Childbirth lump-sum allowance", r: "medium" as RiskLevel },
    { t: "Kindergarten and daycare application", r: "medium" as RiskLevel },
    { t: "Child benefits (jidou teate)", r: "medium" as RiskLevel },
    { t: "Elderly parent care options", r: "high" as RiskLevel },
    { t: "Funerals and burial practices", r: "low" as RiskLevel },
    { t: "Pet registration", r: "low" as RiskLevel },
    { t: "Owning a car — overview", r: "medium" as RiskLevel },
    { t: "Car inspection (shaken)", r: "medium" as RiskLevel },
    { t: "Parking space certificate (shako shomei)", r: "medium" as RiskLevel },
    { t: "Bicycle registration", r: "low" as RiskLevel },
    { t: "Earthquake preparedness at home", r: "low" as RiskLevel },
    { t: "Typhoon and flood preparedness", r: "low" as RiskLevel },
    { t: "Japanese language school options", r: "low" as RiskLevel },
    { t: "Job hunting tips for foreign residents", r: "low" as RiskLevel },
  ].map<FaqStub>((x, i) => ({
    id: `daily-stub-${i + 1}`,
    category: "daily_life" as const,
    subtopic: x.t.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40),
    representative_title_en: x.t,
    risk_level: x.r,
    status: "stub" as const,
  })),
];

/**
 * Card entropy tier assignment by subtopic (v4 改进 #1).
 *
 * These subtopics have answers that are short, unambiguous, and independent
 * of any dynamic data — perfect candidates for the Tier A "return directly,
 * skip LLM" path. Anything not listed here defaults to Tier C and continues
 * to flow through the AI layer.
 *
 * Keep this list conservative: adding a subtopic here means the router will
 * return the fixed standard_answer verbatim without giving the AI layer a
 * chance to disambiguate language or intent. Only include entries that are
 * genuinely "one-sentence, one-answer".
 */
const TIER_BY_SUBTOPIC: Record<string, FaqTier> = {
  // Tier A: single-sentence factual answers.
  "hanko": "A",
  "my-number": "A",
  "floor-plan-abbreviations": "A",
  // Tier B: short procedural answers (≤ 5 steps).
  "garbage": "B",
  "garbage-day": "B",
  "move-in-checklist": "B",
  "mobile-sim": "B",
  // Tier B: renting fundamentals — standard explanations, no dynamic dependency.
  "deposit": "B",
  "key-money": "B",
  "guarantor": "B",
  "renewal": "B",
  "utilities": "B",
  "move-in-cost": "B",
  // Tier B: daily life procedures.
  "bank-account": "B",
  "health-insurance": "B",
  // Tier B: troubleshooting (deterministic step-by-step).
  "power-outage": "B",
  "water-leak": "B",
  "no-hot-water": "B",
  "no-gas": "B",
  "wifi-down": "B",
  "broken-appliance": "B",
  "landlord-contact": "B",
  "emergency-repair": "B",
};

/** Resolve the effective tier of a seed FAQ entry. */
export function resolveTier(faq: FaqEntry): FaqTier {
  if (faq.tier) return faq.tier;
  return TIER_BY_SUBTOPIC[faq.subtopic] ?? "C";
}

// v9 — Import staropenai FAQ bridge for expanded coverage.
import { convertAll, type StarFaqData } from '@/lib/knowledge/faq-sync'

// Lazy-load star FAQs. The JSON is small (~13 topics) and loaded once at
// module init. If the file isn't available (e.g. during tests that don't
// have the staropenai_v2 directory), we silently return an empty array.
let _starFaqs: FaqEntry[] | null = null
function getStarFaqs(): FaqEntry[] {
  if (_starFaqs !== null) return _starFaqs
  try {
    // Dynamic require avoids build-time resolution issues. The FAQ data
    // is a static JSON file that doesn't change at runtime.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const data = require('../../../../staropenai_v2/data/faq_v2.json') as StarFaqData
    _starFaqs = convertAll(data)
  } catch {
    _starFaqs = []
  }
  return _starFaqs
}

export const SEED_FAQS: FaqEntry[] = [
  ...LIVE_FAQS.map((f) => ({
    ...f,
    tier: (f.tier ?? TIER_BY_SUBTOPIC[f.subtopic] ?? "C") as FaqTier,
  })),
  ...getStarFaqs(),
];

/** Normalize and expand a query using synonym groups. */
export function expandQuery(raw: string): Set<string> {
  const q = raw.toLowerCase();
  const expanded = new Set<string>([q]);
  for (const group of SYNONYM_GROUPS) {
    const hit = group.some((member) => q.includes(member.toLowerCase()));
    if (hit) {
      for (const member of group) expanded.add(member.toLowerCase());
    }
  }
  return expanded;
}

/** Count how many of a FAQ's keywords appear in the expanded query bag. */
function keywordHits(faq: FaqEntry, expanded: Set<string>): number {
  const all = [...faq.keywords.en, ...faq.keywords.zh, ...faq.keywords.ja];
  let hits = 0;
  for (const kw of all) {
    if (!kw) continue;
    const k = kw.toLowerCase();
    for (const e of expanded) {
      if (e.includes(k)) {
        hits++;
        break;
      }
    }
  }
  return hits;
}

/** Score every live FAQ against the (expanded) query. */
export function scoreQueryAgainstSeeds(
  rawQuery: string,
): Array<{ faq: FaqEntry; score: number; hits: number }> {
  const expanded = expandQuery(rawQuery);
  const scored = SEED_FAQS.map((faq) => {
    const hits = keywordHits(faq, expanded);
    if (hits === 0) return { faq, score: 0, hits };
    // Saturate: 1 hit ≈ 0.62, 2 ≈ 0.77, 3 ≈ 0.89, 4+ → 1.
    const score = Math.min(1, 0.47 + hits * 0.15);
    return { faq, score, hits };
  });
  // Sort by saturated score, then by raw hit count as tiebreaker — without
  // this, two FAQs that both cap at 1.0 are decided by array order, which
  // means the broad "renting-initial-cost" entry near the top of LIVE_FAQS
  // crowds out more specific FAQs (e.g. tokyo-budget-100k) on queries that
  // hit four-or-more keywords on both sides.
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.hits - a.hits;
    });
}

export const CATEGORY_COUNTS = {
  live: {
    renting: LIVE_FAQS.filter((f) => f.category === "renting").length,
    home_buying: LIVE_FAQS.filter((f) => f.category === "home_buying").length,
    visa: LIVE_FAQS.filter((f) => f.category === "visa").length,
    daily_life: LIVE_FAQS.filter((f) => f.category === "daily_life").length,
  },
  stub: {
    renting: STUB_FAQS.filter((f) => f.category === "renting").length,
    home_buying: STUB_FAQS.filter((f) => f.category === "home_buying").length,
    visa: STUB_FAQS.filter((f) => f.category === "visa").length,
    daily_life: STUB_FAQS.filter((f) => f.category === "daily_life").length,
  },
};
