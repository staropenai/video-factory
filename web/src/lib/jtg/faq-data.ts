/**
 * lib/jtg/faq-data.ts — Homepage FAQ seed data.
 *
 * This is the curated FAQ content shown on the JTG homepage tabs.
 * In production, this module should be replaced with a CMS or DB fetch.
 *
 * The TabKey values map to the homepage tab slugs (spec §3.1).
 * FAQ_DATA is English. FAQ_DATA_ZH is zh-Hans.
 * The homepage picks the correct dataset by locale.
 */

export type TabKey = "rent_prep" | "signing" | "living" | "life";

export interface FaqItem {
  q: string;
  a: string;
  tag: string;
  /** ISO date string of last editorial verification */
  verified: string;
}

export const FAQ_DATA: Record<TabKey, FaqItem[]> = {
  rent_prep: [
    {
      q: "Can foreigners rent an apartment in Japan?",
      a: "Yes, but some landlords decline foreign tenants. Using a guarantor company (hoshō gaisha) reduces this significantly. Agencies that advertise 外国人可 (foreigners welcome) are the most reliable starting point.",
      tag: "Eligibility",
      verified: "2026-03-01",
    },
    {
      q: "How much is the security deposit (shikikin)? Will I get it back?",
      a: "Typically 1–2 months' rent. It is refunded at move-out minus legally-allowable deductions. The National Land Agency guidelines define what landlords can and cannot deduct — normal wear is their responsibility.",
      tag: "Costs",
      verified: "2026-03-01",
    },
    {
      q: "What is a guarantor company (hoshō gaisha) and what does it cost?",
      a: "A guarantor company underwrites your tenancy on behalf of the landlord. Initial fee is typically 0.5–1× monthly rent; annual renewal around ¥10,000. It has largely replaced personal guarantors for foreign tenants.",
      tag: "Process",
      verified: "2026-02-15",
    },
    {
      q: "I have no Japanese bank account yet. Can I still rent?",
      a: "You can sign a contract without one, but you will need an account to set up recurring rent payments. Japan Post Bank (yuucho) is one of the easiest to open with a residence card.",
      tag: "Process",
      verified: "2026-02-15",
    },
  ],
  signing: [
    {
      q: "What clauses should I check before signing?",
      a: "Key areas: special conditions (tokuyaku jikō), restoration-to-original-condition scope, pets/instruments policy, and penalty amounts. Upload the contract to AI analysis for a plain-language summary of high-risk clauses.",
      tag: "Contract",
      verified: "2026-03-01",
    },
    {
      q: "The contract is entirely in Japanese — what do I do?",
      a: "You can upload a screenshot or photo of the contract. AI will try to extract key clauses and flag unusual terms. For binding decisions, confirm findings with a human agent or a licensed judicial scrivener.",
      tag: "Contract",
      verified: "2026-03-01",
    },
    {
      q: "Full-width vs. half-width characters on forms — which to use?",
      a: "Numbers are usually half-width (1234). Names and addresses typically use full-width (１２３４). Follow the on-form instructions; mismatches can cause applications to be rejected.",
      tag: "Application",
      verified: "2026-02-01",
    },
  ],
  living: [
    {
      q: "No hot water — what should I do first?",
      a: "Check: (1) Is gas service active? (2) Does the water heater display an error code? (3) Is the set temperature too low? If none of those explain it, contact the management office (kanri gaisha) by message or phone.",
      tag: "Equipment",
      verified: "2026-03-15",
    },
    {
      q: "Move-out: what is restoration to original condition (genjokaifuku)?",
      a: "Normal aging — faded walls, small marks — is the landlord's responsibility under national guidelines. Tenant-caused damage requires repair or compensation. Upload your contract to check the specific clause in your lease.",
      tag: "Move-out",
      verified: "2026-03-15",
    },
    {
      q: "How does rubbish separation work?",
      a: "Rules differ by ward. Search '[your ward name] ゴミ 分別' for the official PDF. Generally: combustible waste 2× per week, non-combustible 1× per week, oversized items by appointment.",
      tag: "Daily life",
      verified: "2026-02-01",
    },
  ],
  life: [
    {
      q: "I just arrived — what do I need to do first?",
      a: "Priority order: (1) Register at your ward office (jūminhyō), (2) Update address on your residence card, (3) Open a bank account, (4) Get a SIM. Skipping step 1 blocks most of the others.",
      tag: "New arrival",
      verified: "2026-04-01",
    },
    {
      q: "How do I set up gas, electricity, and water?",
      a: "Water is usually pre-connected. Electricity: open the meter panel and call the utility listed inside. Gas: must be activated by an engineer in person — schedule an appointment and be home. Gas is the most common forgotten step.",
      tag: "Move-in",
      verified: "2026-04-01",
    },
    {
      q: "Which SIM card should I get in Japan?",
      a: "Short-term / passport only: IIJmio or Mineo. Long-term / residence card: Rakuten Mobile or ahamo offer good value. Airport SIMs are available as a bridge for the first few days.",
      tag: "Daily life",
      verified: "2026-03-01",
    },
  ],
};

/** zh-Hans FAQ data — Chinese translations + V6 new questions */
export const FAQ_DATA_ZH: Record<TabKey, FaqItem[]> = {
  rent_prep: [
    {
      q: "外国人能在日本租房吗？",
      a: "可以，但部分房东会拒绝外国租客。使用保证公司（保証会社）可以显著降低被拒率。标注「外国人可」的中介是最可靠的起点。",
      tag: "资格",
      verified: "2026-03-01",
    },
    {
      q: "押金（敷金）一般多少？能退吗？",
      a: "通常为 1-2 个月房租。退房时退还，扣除法律允许的费用。国土交通省的指导方针规定了房东可以和不可以扣除的项目——正常磨损由房东承担。",
      tag: "费用",
      verified: "2026-03-01",
    },
    {
      q: "保证公司（保証会社）是什么？费用多少？",
      a: "保证公司代替房东为您的租约做担保。初始费用通常为 0.5-1 倍月租；年度续费约 ¥10,000。对于外国租客，它基本取代了个人担保人。",
      tag: "流程",
      verified: "2026-02-15",
    },
    {
      q: "还没有日本银行账户，能租房吗？",
      a: "可以签合同，但需要开户才能设置自动转账付房租。邮政银行（ゆうちょ）是凭在留卡最容易开户的银行之一。",
      tag: "流程",
      verified: "2026-02-15",
    },
    {
      q: "怎么验证中介资质是否真实？",
      a: "可以在国土交通省的「建設業者・宅建業者等企業情報検索システム」中输入中介的免许番号进行查询。JTG 的 AI 分析也会自动核验中介资质。",
      tag: "信任",
      verified: "2026-04-15",
    },
    {
      q: "AI 分析截图准确吗？",
      a: "AI 会尽力提取截图中的关键信息（房租、面积、车站等），但准确度受截图清晰度影响。结果仅供参考，签约前请与中介或人工客服确认。",
      tag: "信任",
      verified: "2026-04-15",
    },
    {
      q: "我的截图上传后会被保存吗？",
      a: "截图仅用于本次分析，不会永久保存在服务器上。分析完成后，原始文件从临时存储中删除。生成的分析摘要会保留时间戳记录，供您后续核验。",
      tag: "信任",
      verified: "2026-04-15",
    },
  ],
  signing: [
    {
      q: "签约前要检查哪些条款？",
      a: "重点关注：特约事项（特約事項）、原状恢复范围、宠物/乐器政策、以及违约金金额。上传合同截图给 AI，可以获得高风险条款的通俗说明。",
      tag: "合同",
      verified: "2026-03-01",
    },
    {
      q: "合同全是日文怎么办？",
      a: "可以上传合同截图或照片。AI 会尝试提取关键条款并标记异常内容。涉及法律效力的决定，请与人工客服或行政书士确认。",
      tag: "合同",
      verified: "2026-03-01",
    },
    {
      q: "表格上全角和半角怎么选？",
      a: "数字通常用半角（1234），姓名和地址通常用全角（１２３４）。按表格上的说明填写即可，格式不对可能导致申请被退回。",
      tag: "申请",
      verified: "2026-02-01",
    },
    {
      q: "电子签名在日本合法吗？",
      a: "是的，日本的《电子签名法》承认电子签名的法律效力，但部分房东和管理公司仍要求纸质签名。签约前请确认对方是否接受电子签名。",
      tag: "合同",
      verified: "2026-04-15",
    },
    {
      q: "合同被篡改了怎么知道？",
      a: "JTG 为每份上传的合同生成 SHA-256 哈希摘要。如果合同内容被修改，哈希值会完全不同。您可以随时在「存证查询」页面核验文件完整性。",
      tag: "信任",
      verified: "2026-04-15",
    },
  ],
  living: [
    {
      q: "没有热水怎么办？",
      a: "检查：(1) 燃气是否开通？(2) 热水器是否显示错误代码？(3) 设定温度是否太低？如果都不是，请联系管理公司（管理会社）。",
      tag: "设备",
      verified: "2026-03-15",
    },
    {
      q: "退房时的「原状恢复」是什么？",
      a: "正常老化（墙面褪色、小痕迹等）由房东承担。租客造成的损坏需要修复或赔偿。上传合同截图可以查看您租约中的具体条款。",
      tag: "退房",
      verified: "2026-03-15",
    },
    {
      q: "垃圾分类怎么做？",
      a: "规则因区而异。搜索「[您所在区名] ゴミ 分別」可以找到官方 PDF。一般来说：可燃垃圾每周 2 次，不可燃垃圾每周 1 次，大件垃圾需预约。",
      tag: "生活",
      verified: "2026-02-01",
    },
    {
      q: "我的数据会被用来做广告吗？",
      a: "不会。JTG 不会将您的数据用于广告投放，也不会出售给第三方。您的数据仅用于为您提供服务。详情请查看我们的隐私政策。",
      tag: "信任",
      verified: "2026-04-15",
    },
    {
      q: "怎么查看我的操作历史？",
      a: "登录后可以在个人中心查看所有操作记录，包括 AI 分析记录、客服咨询记录和存证时间戳。未登录用户的记录仅保留在当前会话中。",
      tag: "信任",
      verified: "2026-04-15",
    },
  ],
  life: [
    {
      q: "刚到日本，第一步做什么？",
      a: "优先顺序：(1) 去区役所办理住民登记（住民票），(2) 更新在留卡上的地址，(3) 开银行账户，(4) 办 SIM 卡。跳过第 1 步会导致后面大部分事情无法办理。",
      tag: "新到",
      verified: "2026-04-01",
    },
    {
      q: "水电燃气怎么开通？",
      a: "水通常是预先接通的。电力：打开电表箱，拨打上面标注的电力公司电话。燃气：必须由工程师上门开通——需要预约并在家等候。燃气是最容易忘记的一步。",
      tag: "入住",
      verified: "2026-04-01",
    },
    {
      q: "在日本用什么 SIM 卡？",
      a: "短期/仅护照：IIJmio 或 Mineo。长期/有在留卡：Rakuten Mobile 或 ahamo 性价比最高。机场 SIM 卡可以作为头几天的过渡。",
      tag: "生活",
      verified: "2026-03-01",
    },
  ],
};

/** Get FAQ data for the given locale. zh-Hans uses Chinese; all others use English. */
export function getFaqData(locale: string): Record<TabKey, FaqItem[]> {
  if (locale === "zh-Hans") return FAQ_DATA_ZH;
  return FAQ_DATA;
}
