/**
 * src/lib/i18n/homepage.ts
 *
 * All user-visible strings for the homepage, organised by locale.
 * No copy lives inside components — change text here only.
 *
 * Supported locales (V3 spec §6.1 two-tier model):
 *   Tier 1 (full):    zh-Hans, en, ja
 *   Tier 2 (core):    ko, vi, th
 *
 * Keys map 1-to-1 with UI slots.
 */

export type Locale = "zh-Hans" | "en" | "ja" | "ko" | "vi" | "th";

export interface HomepageCopy {
  // Nav
  navLogin:          string;
  navSaved:          string;

  // Hero
  eyebrow:           string;
  heroTitle:         string;
  heroSub:           string;

  // Primary entry cards
  card1Label:        string;
  card1Hint:         string;
  card2Label:        string;
  card2Hint:         string;
  card3Label:        string;
  card3Hint:         string;

  // 3-step guide (shown on card1 expand)
  guideTitle:        string;
  step1:             string;
  step2:             string;
  step3:             string;

  // FAQ tabs
  tabRentPrep:       string;
  tabSigning:        string;
  tabLiving:         string;
  tabLife:           string;

  // FAQ search
  searchPlaceholder: string;
  hotLabel:          string;

  // AI zone
  aiZoneTitle:       string;
  aiPlaceholder:     string;
  aiSendLabel:       string;
  aiDisclaimer:      string;   // "results for reference only" — spec §3.5 fixed copy
  aiQuotaFmt:        string;   // e.g. "{remaining}/{limit} left today"
  aiQuotaExhausted:  string;

  // Trust bar
  trustTitle:        string;
  trust1:            string;
  trust2:            string;
  trust3:            string;

  // Human help — split two paths (spec §3.4)
  humanTitle:        string;
  humanLangBadge:    string;
  humanDesc:         string;

  // Info-send path confirmation (spec §3.4-A)
  confirmTitle:      string;
  confirmBody:       string;
  confirmOk:         string;
  confirmCancel:     string;

  // Direct phone path (spec §3.4-B)
  phoneLabel:        string;
  phoneDesc:         string;

  // Channels
  channelLine:       string;
  channelWechat:     string;
  channelEmail:      string;
  channelWhatsApp:   string;
  channelPhone:      string;

  // External platform area
  externalLabel:     string;   // "External link" marker (spec §3.10)
  externalNote:      string;   // "Opens external site — not affiliated" (spec §3.10)

  // Footer
  footerDisclaimer:  string;
  footerPrivacy:     string;
  footerTerms:       string;
  footerTranslation: string;

  // AI loading / error states
  aiThinking:        string;   // shown while waiting for AI response
  aiError:           string;   // generic network / server error message
  aiFromKB:          string;   // label shown for Tier A/B (knowledge base) answers

  // Listing analysis staged loading (V4 spec — three sequential labels)
  analysisStage1:    string;   // "Reading image…" / extracting
  analysisStage2:    string;   // "Extracting key fields…"
  analysisStage3:    string;   // "Analyzing…"
  /** @deprecated Use analysisStage1-3 instead. Kept for backwards compat. */
  analysisThinking:  string;

  // AI response action buttons
  aiBtnCopy:         string;   // "Copy" button on completed answers
  aiBtnRetry:        string;   // "Retry" button on error state
  aiBtnContact:      string;   // "Contact support" button

  // Listing analysis zone (spec §3.3)
  analysisTabScreenshot: string;
  analysisTabUrl:        string;
  analysisTabText:       string;
  analysisDropHint:      string;   // "Tap or drag a screenshot here"
  analysisDropFormats:   string;   // "JPG, PNG, WebP — max 10 MB"
  analysisUrlPlaceholder: string;
  analysisUrlNote:       string;
  analysisTextPlaceholder: string;
  analysisTextNote:      string;
  analysisSubmit:        string;   // "Analyse"
  analysisDisclaimer:    string;   // mandatory §3.5 disclaimer

  // External platforms section
  externalBrowseHint:    string;   // "Browse on these platforms, then come back to analyse:"

  // FAQ zone
  faqNoResults:          string;   // "No results — try the AI below …"
  faqVerified:           string;   // "Verified {date}" — use {date} placeholder

  // Tier 2 completeness notice
  tier2Notice:       string;

  // ── V6 Trust & Transparency keys ──────────────────────────────────────────

  // Trust Promise Bar (ZONE 2)
  trustPromise1:        string;
  trustPromise2:        string;
  trustPromise3:        string;
  trustPromise4:        string;
  trustPromise5:        string;

  // Trust Promise Bar — detail copy (shown on expand)
  trustPromise1Detail:  string;
  trustPromise2Detail:  string;
  trustPromise3Detail:  string;
  trustPromise4Detail:  string;
  trustPromise5Detail:  string;

  // Trust Dashboard (ZONE 4c)
  trustDashboardTitle:      string;
  trustDashboardSubtitle:   string;
  trustDashboardDisclaimer: string;
  trustStatusVerified:      string;
  trustStatusPartial:       string;
  trustStatusRisk:          string;
  trustStatusUnknown:       string;
  trustStatusPending:       string;

  // Evidence / timestamping
  evidenceTimestampLabel: string;
  evidenceViewDetail:     string;
  evidenceHashLabel:      string;
  evidenceVerifyMethod:   string;
  evidenceWriteFailed:    string;

  // Transparency layer (ZONE 6b)
  transparencyTitle:       string;
  transparencyEngine:      string;
  transparencyConfidence:  string;
  transparencyDataSources: string;
  engineTierA:             string;
  engineTierB:             string;
  engineTierC:             string;
  confidenceHigh:          string;
  confidenceMedium:        string;
  confidenceLow:           string;

  // Confirmation strip upgrade (ZONE 8/9)
  confirmSendScope:    string;
  confirmNotSend:      string;
  confirmModifyScope:  string;

  // Risk level copy
  riskLow:      string;
  riskMedium:   string;
  riskHigh:     string;
  riskUnknown:  string;

  // Navigation
  trustCenterNavLabel: string;
  verifyNavLabel:      string;

  // Footer compliance
  footerComplianceNote:  string;
  footerReportViolation: string;
  footerEvidenceVerify:  string;

  // ── V6 Fix: additional keys ───────────────────────────────────────────

  // ZONE 1: Loss aversion banner
  lossAversionText:      string;
  lossAversionSource:    string;

  // ZONE 4: Analysis timestamp note
  analysisTimestampNote: string;

  // ZONE 4c: View trust dashboard button
  viewTrustDashboard:    string;

  // ZONE 6: Trust commitment card action labels
  trustAction1Label:     string;
  trustAction2aLabel:    string;
  trustAction2bLabel:    string;
  trustAction3Label:     string;
  trustAction3LoginHint: string;
  trustAction4Label:     string;
  trustAction5aLabel:    string;
  trustAction5bLabel:    string;

  // ZONE 6b: Transparency layer extras
  transparencyDisclaimer:   string;
  transparencyExpandLabel:  string;
  transparencyAnalysisTime: string;
  transparencyEvidenceHash: string;
  transparencyViewFull:     string;

  // ZONE 8: Confirmation strip items
  confirmSendItem1:     string;
  confirmSendItem2:     string;
  confirmSendItem3:     string;
  confirmSendItem4:     string;
  confirmNotSendItem1:  string;
  confirmNotSendItem2:  string;
  confirmNotSendItem3:  string;
}

const copy: Record<Locale, HomepageCopy> = {

  // ──────────────────────────────────────────────────────────────────────
  "zh-Hans": {
    navLogin:          "登录",
    navSaved:          "已保存记录",

    eyebrow:           "刚来日本？我们来帮你",
    heroTitle:         "在日本租房、看房、解决生活问题\n这里手把手带你走",
    heroSub:           "不懂日语没关系 · 支持中文沟通 · 免费开始使用",

    card1Label:        "先去看房源\nAI 帮我分析",
    card1Hint:         "截图 / 链接 / 文字描述 → AI 解读 → 人工跟进",
    card2Label:        "租房全流程\n避坑指南",
    card2Hint:         "押金、合同、保证会社",
    card3Label:        "有问题\n直接问",
    card3Hint:         "AI 回答 · 中文客服兜底",

    guideTitle:        "怎么用「先去看房源」？三步搞定：",
    step1:             "点下方平台链接，去 AtHome / SUUMO 看房",
    step2:             "看到喜欢的 → 截图回来上传，或直接粘贴链接",
    step3:             "AI 辅助解读，复杂问题交给中文客服",

    tabRentPrep:       "租房准备",
    tabSigning:        "申请与签约",
    tabLiving:         "入住后问题",
    tabLife:           "生活",

    searchPlaceholder: "搜索问题，例如：押金退不退…",
    hotLabel:          "本周大家最关心",

    aiZoneTitle:       "没找到答案？直接问",
    aiPlaceholder:     "说出你的情况，例如：我是越南人，想在大阪租 1K…",
    aiSendLabel:       "发送",
    aiDisclaimer:      "分析结果仅供参考，具体以平台页面及人工确认信息为准。",
    aiQuotaFmt:        "今日剩余 {remaining}/{limit} 次",
    aiQuotaExhausted:  "今日额度已用完，明日零点重置。如需继续，可联系人工帮助。",
    aiThinking:        "正在分析中…",
    aiError:           "请求出错，请稍后再试。也可以直接联系人工帮助。",
    aiFromKB:          "来自知识库",
    analysisStage1:    "正在读取图片…",
    analysisStage2:    "提取关键信息…",
    analysisStage3:    "正在分析…",
    analysisThinking:  "正在解读房源信息…",
    aiBtnCopy:         "复制",
    aiBtnRetry:        "重试",
    aiBtnContact:      "联系人工客服",
    analysisTabScreenshot: "截图",
    analysisTabUrl:        "粘贴链接",
    analysisTabText:       "文字描述",
    analysisDropHint:      "点击或拖入房源截图",
    analysisDropFormats:   "JPG、PNG、WebP — 最大 10 MB",
    analysisUrlPlaceholder: "粘贴 AtHome / SUUMO / LIFULL 房源链接",
    analysisUrlNote:       "将抓取并分析该页面。结果仅供参考。",
    analysisTextPlaceholder: "描述你看到的房源：房租、面积、车站、建筑年龄…",
    analysisTextNote:      "想到多少写多少，AI 会尽量提取关键信息。",
    analysisSubmit:        "分析",
    analysisDisclaimer:    "分析结果仅供参考，请以原始房源页面或人工客服确认为准。",
    externalBrowseHint:    "先在这些平台浏览房源，再回来分析：",
    faqNoResults:          "没有找到结果 — 试试下方 AI 问答或联系人工客服。",
    faqVerified:           "已验证 {date}",

    trustTitle:        "内容来源说明",
    trust1:            "基于公开资料与内部整理内容编写",
    trust2:            "非法律意见，具体以官方及专业人士意见为准",
    trust3:            "各条内容显示最近核验日期",

    humanTitle:        "联系人工帮助",
    humanLangBadge:    "支持中文",
    humanDesc:         "通知看不懂 · 不确定该不该签 · 担心费用问题 → 这些情况交给人工",

    confirmTitle:      "联系人工前确认",
    confirmBody:       "我们会将您刚才提交的内容和问题摘要发送给客服，仅用于本次咨询。当前支持中文沟通，本次咨询免费。",
    confirmOk:         "确认发送，接通客服",
    confirmCancel:     "取消",

    phoneLabel:        "电话咨询（更快）",
    phoneDesc:         "可直接拨打客服热线。接线前平台对您的问题了解较少。如需客服先查看截图或问题摘要，请使用在线联系渠道。",

    channelLine:       "LINE",
    channelWechat:     "微信",
    channelEmail:      "邮件",
    channelWhatsApp:   "WhatsApp",
    channelPhone:      "电话",

    externalLabel:     "外部链接",
    externalNote:      "将跳转至外部房产平台，与本站无从属关系",

    footerDisclaimer:  "内容为信息辅助，不构成法律意见。具体以官方机构及专业人士意见为准。",
    footerPrivacy:     "隐私政策",
    footerTerms:       "服务条款",
    footerTranslation: "翻译质量说明",

    tier2Notice:       "",

    // V6 Trust & Transparency
    trustPromise1:        "身份可验证",
    trustPromise2:        "文件可验真",
    trustPromise3:        "流程可追踪",
    trustPromise4:        "风险可解释",
    trustPromise5:        "数据被保护",
    trustPromise1Detail:  "中介资质通过国土交通省数据库核验",
    trustPromise2Detail:  "上传文件与公开数据库交叉比对",
    trustPromise3Detail:  "每步操作记录存证，可随时查阅",
    trustPromise4Detail:  "已知风险和未纳入因素均明确列出",
    trustPromise5Detail:  "数据加密传输，不与第三方共享原始内容",
    trustDashboardTitle:      "可信看板",
    trustDashboardSubtitle:   "基于您上传的内容，以下项目已完成审核",
    trustDashboardDisclaimer: "分析基于截图内容，仅供参考。签约前请与持牌专业人士确认。",
    trustStatusVerified:      "已确认",
    trustStatusPartial:       "部分确认",
    trustStatusRisk:          "风险项",
    trustStatusUnknown:       "无法判定",
    trustStatusPending:       "分析中",
    evidenceTimestampLabel: "本次分析已生成存证记录",
    evidenceViewDetail:     "查看存证摘要",
    evidenceHashLabel:      "哈希摘要",
    evidenceVerifyMethod:   "如何验证文件完整性",
    evidenceWriteFailed:    "存证记录写入失败——请联系客服",
    transparencyTitle:       "本次分析的技术透明度",
    transparencyEngine:      "分析引擎",
    transparencyConfidence:  "置信度",
    transparencyDataSources: "数据来源",
    engineTierA:             "直接匹配（精确关键词）",
    engineTierB:             "语义匹配（知识库）",
    engineTierC:             "AI 推理（大模型辅助，非精确匹配）",
    confidenceHigh:          "高",
    confidenceMedium:        "中",
    confidenceLow:           "较低（图片质量影响提取精度）",
    confirmSendScope:    "我们将向客服发送以下信息",
    confirmNotSend:      "不发送",
    confirmModifyScope:  "修改发送范围",
    riskLow:      "风险较低——请核实以下项目后继续",
    riskMedium:   "部分项目需关注——建议人工审核",
    riskHigh:     "发现重要风险项——强烈建议专业人士审核",
    riskUnknown:  "信息不足——请补充更多细节或联系客服",
    trustCenterNavLabel: "信任中心",
    verifyNavLabel:      "验证记录",
    footerComplianceNote:  "本平台不提供法律、税务或投资建议。所有分析结果仅供参考。",
    footerReportViolation: "举报违规",
    footerEvidenceVerify:  "存证查询",

    // ZONE 1
    lossAversionText:      "在日本，39.3% 的外国人曾因国籍被拒租（法务省数据）",
    lossAversionSource:    "法务省",

    // ZONE 4
    analysisTimestampNote: "本次分析结果将生成时间戳记录，供您后续核验",

    // ZONE 4c
    viewTrustDashboard:    "查看可信看板",

    // ZONE 6 actions
    trustAction1Label:     "国土交通省核查 ↗",
    trustAction2aLabel:    "了解验证方法",
    trustAction2bLabel:    "查看存证记录",
    trustAction3Label:     "查看操作历史",
    trustAction3LoginHint: "需登录",
    trustAction4Label:     "查看风险评估方法",
    trustAction5aLabel:    "隐私政策",
    trustAction5bLabel:    "申请删除数据",

    // ZONE 6b extras
    transparencyDisclaimer:   "以上信息用于技术透明，不改变「仅供参考」的性质",
    transparencyExpandLabel:  "展开",
    transparencyAnalysisTime: "分析时间",
    transparencyEvidenceHash: "存证摘要",
    transparencyViewFull:     "查看完整",

    // ZONE 8 items
    confirmSendItem1:     "分析截图缩略图",
    confirmSendItem2:     "AI 分析摘要（非原文）",
    confirmSendItem3:     "您的问题内容",
    confirmSendItem4:     "操作时间戳",
    confirmNotSendItem1:  "截图原文件",
    confirmNotSendItem2:  "您的身份信息（未登录时）",
    confirmNotSendItem3:  "设备信息",
  },

  // ──────────────────────────────────────────────────────────────────────
  "en": {
    navLogin:          "Sign in",
    navSaved:          "Saved records",

    eyebrow:           "Just arrived in Japan?",
    heroTitle:         "Find housing, understand contracts,\nsolve everyday life in Japan",
    heroSub:           "No Japanese needed · English & Chinese support · Free to start",

    card1Label:        "Browse listings\nAI reads them for you",
    card1Hint:         "Screenshot / link / description → AI analysis → human follow-up",
    card2Label:        "Full renting guide\nAvoid common traps",
    card2Hint:         "Deposit, contracts, guarantors",
    card3Label:        "Have a question?\nJust ask",
    card3Hint:         "AI answers · human backup",

    guideTitle:        'How to use "Browse listings"? Three steps:',
    step1:             "Click a platform link below to browse AtHome / SUUMO",
    step2:             "Find something you like → screenshot, or paste the link here",
    step3:             "AI helps read the listing; complex questions go to a human agent",

    tabRentPrep:       "Renting basics",
    tabSigning:        "Application & signing",
    tabLiving:         "After move-in",
    tabLife:           "Daily life",

    searchPlaceholder: "Search, e.g. can I get a refund on the deposit…",
    hotLabel:          "Most asked this week",

    aiZoneTitle:       "Didn't find an answer? Ask directly",
    aiPlaceholder:     "Describe your situation, e.g. I'm Vietnamese looking for a 1K in Osaka…",
    aiSendLabel:       "Send",
    aiDisclaimer:      "AI analysis is for reference only. Verify details with the listing page or a human agent.",
    aiQuotaFmt:        "{remaining}/{limit} uses left today",
    aiQuotaExhausted:  "Daily limit reached. Resets at midnight. Contact a human agent to continue.",
    aiThinking:        "Thinking…",
    aiError:           "Something went wrong. Please try again or contact a human agent.",
    aiFromKB:          "From knowledge base",
    analysisStage1:    "Reading image…",
    analysisStage2:    "Extracting key fields…",
    analysisStage3:    "Analyzing…",
    analysisThinking:  "Reading the listing…",
    aiBtnCopy:         "Copy",
    aiBtnRetry:        "Retry",
    aiBtnContact:      "Contact support",
    analysisTabScreenshot: "Screenshot",
    analysisTabUrl:        "Paste link",
    analysisTabText:       "Describe in text",
    analysisDropHint:      "Tap or drag a screenshot here",
    analysisDropFormats:   "JPG, PNG, WebP — max 10 MB",
    analysisUrlPlaceholder: "Paste an AtHome / SUUMO / LIFULL listing URL",
    analysisUrlNote:       "The page will be fetched and analysed. Results are for reference only.",
    analysisTextPlaceholder: "Describe the listing you saw: rent, size, station, age of building…",
    analysisTextNote:      "Type as much or as little as you know. AI will try to extract what it can.",
    analysisSubmit:        "Analyse",
    analysisDisclaimer:    "Analysis results are for reference only — verify with the listing page or a human agent.",
    externalBrowseHint:    "Browse on these platforms, then come back to analyse:",
    faqNoResults:          "No results — try the AI below or contact a human agent.",
    faqVerified:           "Verified {date}",

    trustTitle:        "About our content",
    trust1:            "Based on public resources and internal research",
    trust2:            "Not legal advice — consult official sources and professionals",
    trust3:            "Each FAQ shows its last verified date",

    humanTitle:        "Talk to a human agent",
    humanLangBadge:    "English & Chinese",
    humanDesc:         "Can't understand a notice · unsure about signing · worried about fees → hand it to a human",

    confirmTitle:      "Before we connect you",
    confirmBody:       "We'll send your submitted content and a brief summary to the agent — for this consultation only. English & Chinese support available. This consultation is free.",
    confirmOk:         "Confirm — connect me to an agent",
    confirmCancel:     "Cancel",

    phoneLabel:        "Call us directly (fastest)",
    phoneDesc:         "Call our support line directly. The agent will have less context about your situation beforehand. If you'd like the agent to review your screenshot or summary first, use an online channel instead.",

    channelLine:       "LINE",
    channelWechat:     "WeChat",
    channelEmail:      "Email",
    channelWhatsApp:   "WhatsApp",
    channelPhone:      "Phone",

    externalLabel:     "External link",
    externalNote:      "Opens an external property platform. Not affiliated with this site.",

    footerDisclaimer:  "Content is for informational purposes only and does not constitute legal advice. Consult official sources and qualified professionals for specific guidance.",
    footerPrivacy:     "Privacy policy",
    footerTerms:       "Terms of service",
    footerTranslation: "Translation quality",

    tier2Notice:       "",

    // V6 Trust & Transparency
    trustPromise1:        "Identity verifiable",
    trustPromise2:        "Documents verifiable",
    trustPromise3:        "Process trackable",
    trustPromise4:        "Risks explainable",
    trustPromise5:        "Data protected",
    trustPromise1Detail:  "Agent licence verified against MLIT database",
    trustPromise2Detail:  "Uploaded documents cross-referenced with public records",
    trustPromise3Detail:  "Every step is logged with an evidence record you can review",
    trustPromise4Detail:  "Known risks and unassessed factors are listed explicitly",
    trustPromise5Detail:  "Data encrypted in transit — original content never shared with third parties",
    trustDashboardTitle:      "Trust dashboard",
    trustDashboardSubtitle:   "Based on your upload, the following has been reviewed",
    trustDashboardDisclaimer: "Analysis is from screenshot only — verify with a human agent before signing",
    trustStatusVerified:      "Confirmed",
    trustStatusPartial:       "Partially confirmed",
    trustStatusRisk:          "Risk item",
    trustStatusUnknown:       "Cannot determine",
    trustStatusPending:       "Analysing",
    evidenceTimestampLabel: "This analysis has a timestamp record",
    evidenceViewDetail:     "View evidence summary",
    evidenceHashLabel:      "Hash digest",
    evidenceVerifyMethod:   "How to verify file integrity",
    evidenceWriteFailed:    "Evidence record failed — please contact support",
    transparencyTitle:       "Technical transparency for this analysis",
    transparencyEngine:      "Analysis engine",
    transparencyConfidence:  "Confidence level",
    transparencyDataSources: "Data sources",
    engineTierA:             "Direct match (exact keyword)",
    engineTierB:             "Semantic match (knowledge base)",
    engineTierC:             "AI reasoning (LLM-assisted, not exact)",
    confidenceHigh:          "High",
    confidenceMedium:        "Medium",
    confidenceLow:           "Lower (image quality affects extraction accuracy)",
    confirmSendScope:    "We will send the following to the agent",
    confirmNotSend:      "Not sent",
    confirmModifyScope:  "Modify what we send",
    riskLow:      "Lower risk — review the items below before proceeding",
    riskMedium:   "Some items need attention — consider human review",
    riskHigh:     "Important risk items found — professional review strongly recommended",
    riskUnknown:  "Insufficient info — add more details or contact an agent",
    trustCenterNavLabel: "Trust center",
    verifyNavLabel:      "Verify record",
    footerComplianceNote:  "This platform does not provide legal, tax, or investment advice. All analysis results are for reference only.",
    footerReportViolation: "Report a violation",
    footerEvidenceVerify:  "Verify evidence",

    lossAversionText:      "In Japan, 39.3% of foreign residents have been refused rental due to nationality (MOJ data)",
    lossAversionSource:    "Ministry of Justice",

    analysisTimestampNote: "This analysis will generate a timestamp record for your future verification",

    viewTrustDashboard:    "View trust dashboard",

    trustAction1Label:     "Check MLIT database ↗",
    trustAction2aLabel:    "Learn verification method",
    trustAction2bLabel:    "View evidence record",
    trustAction3Label:     "View operation history",
    trustAction3LoginHint: "Login required",
    trustAction4Label:     "View risk assessment method",
    trustAction5aLabel:    "Privacy policy",
    trustAction5bLabel:    "Request data deletion",

    transparencyDisclaimer:   "The above is for technical transparency and does not change the 'for reference only' nature",
    transparencyExpandLabel:  "Expand",
    transparencyAnalysisTime: "Analysis time",
    transparencyEvidenceHash: "Evidence digest",
    transparencyViewFull:     "View full",

    confirmSendItem1:     "Analysis screenshot thumbnail",
    confirmSendItem2:     "AI analysis summary (not original text)",
    confirmSendItem3:     "Your question content",
    confirmSendItem4:     "Operation timestamp",
    confirmNotSendItem1:  "Original screenshot file",
    confirmNotSendItem2:  "Your identity information (when not logged in)",
    confirmNotSendItem3:  "Device information",
  },

  // ──────────────────────────────────────────────────────────────────────
  "ja": {
    navLogin:          "ログイン",
    navSaved:          "保存済み",

    eyebrow:           "日本の生活でお困りですか？",
    heroTitle:         "住まい探し・契約・生活の疑問\nわかりやすく解決します",
    heroSub:           "日本語・中国語・英語に対応 · 無料でご利用いただけます",

    card1Label:        "物件を見てから\nAIで解析",
    card1Hint:         "スクリーンショット・URL・テキスト → AI解析 → 担当者へ",
    card2Label:        "賃貸の流れと\n注意点",
    card2Hint:         "敷金・礼金・保証会社",
    card3Label:        "ご質問は\nこちらへ",
    card3Hint:         "AI回答 · 有人サポート",

    guideTitle:        "「物件を見てから」の使い方（3ステップ）",
    step1:             "下記のリンクから AtHome / SUUMO を開いて物件を探す",
    step2:             "気になる物件はスクリーンショット、またはURLをコピーして戻る",
    step3:             "AIが主な内容を解析；複雑な質問は担当者が対応",

    tabRentPrep:       "賃貸準備",
    tabSigning:        "申込・契約",
    tabLiving:         "入居後",
    tabLife:           "生活",

    searchPlaceholder: "例：敷金は返ってきますか…",
    hotLabel:          "今週よく見られています",

    aiZoneTitle:       "答えが見つからない場合は直接質問",
    aiPlaceholder:     "状況を教えてください。例：大阪で1Kを探しているベトナム人です…",
    aiSendLabel:       "送信",
    aiDisclaimer:      "AI の分析結果はあくまで参考情報です。詳細は各物件ページや担当者にご確認ください。",
    aiQuotaFmt:        "本日残り {remaining}/{limit} 回",
    aiQuotaExhausted:  "本日の利用回数に達しました。深夜0時にリセットされます。引き続きご相談の場合は担当者へお問い合わせください。",
    aiThinking:        "分析中…",
    aiError:           "エラーが発生しました。もう一度お試しいただくか、担当者にお問い合わせください。",
    aiFromKB:          "ナレッジベースより",
    analysisStage1:    "画像を読み取り中…",
    analysisStage2:    "情報を抽出中…",
    analysisStage3:    "分析中…",
    analysisThinking:  "物件情報を解析中…",
    aiBtnCopy:         "コピー",
    aiBtnRetry:        "再試行",
    aiBtnContact:      "サポートに連絡",
    analysisTabScreenshot: "スクリーンショット",
    analysisTabUrl:        "リンクを貼る",
    analysisTabText:       "テキストで説明",
    analysisDropHint:      "タップまたはスクリーンショットをここにドラッグ",
    analysisDropFormats:   "JPG、PNG、WebP — 最大 10 MB",
    analysisUrlPlaceholder: "AtHome / SUUMO / LIFULL の物件URLを貼り付け",
    analysisUrlNote:       "ページを取得して分析します。結果は参考情報です。",
    analysisTextPlaceholder: "見た物件を説明してください：家賃、広さ、最寄駅、築年数…",
    analysisTextNote:      "分かる範囲で入力してください。AIが情報を抽出します。",
    analysisSubmit:        "分析する",
    analysisDisclaimer:    "分析結果は参考情報です。物件ページまたは担当者にご確認ください。",
    externalBrowseHint:    "まずこれらのサイトで物件を探し、戻って分析：",
    faqNoResults:          "該当する結果がありません。下のAI問答か人工サポートをお試しください。",
    faqVerified:           "確認済み {date}",

    trustTitle:        "コンテンツについて",
    trust1:            "公開情報および社内調査に基づいています",
    trust2:            "法的アドバイスではありません。専門家・公的機関にご確認ください",
    trust3:            "各 FAQ に最終確認日を表示しています",

    humanTitle:        "担当者に相談する",
    humanLangBadge:    "日本語・中国語対応",
    humanDesc:         "通知が理解できない · 契約を結ぶか迷っている · 費用が心配 → 担当者にお任せください",

    confirmTitle:      "担当者へつなぐ前に確認",
    confirmBody:       "ご提出いただいた内容と問い合わせ概要を担当者に送信します（本件のみ使用）。日本語・中国語での対応が可能です。本相談は無料です。",
    confirmOk:         "内容を送信して担当者につなぐ",
    confirmCancel:     "キャンセル",

    phoneLabel:        "電話で相談（より迅速）",
    phoneDesc:         "直接サポートラインにおかけいただけます。担当者は事前にお客様の状況を把握していません。スクリーンショットや問い合わせ概要を先に共有したい場合は、オンラインチャンネルをご利用ください。",

    channelLine:       "LINE",
    channelWechat:     "WeChat",
    channelEmail:      "メール",
    channelWhatsApp:   "WhatsApp",
    channelPhone:      "電話",

    externalLabel:     "外部リンク",
    externalNote:      "外部の不動産プラットフォームに移動します。本サイトとの提携関係はありません。",

    footerDisclaimer:  "本コンテンツは情報提供のみを目的としており、法的アドバイスを構成するものではありません。具体的な事項については、公的機関や専門家にご相談ください。",
    footerPrivacy:     "プライバシーポリシー",
    footerTerms:       "利用規約",
    footerTranslation: "翻訳品質について",

    tier2Notice:       "",

    // V6 Trust & Transparency
    trustPromise1:        "本人確認可能",
    trustPromise2:        "書類検証可能",
    trustPromise3:        "プロセス追跡可能",
    trustPromise4:        "リスク説明可能",
    trustPromise5:        "データ保護",
    trustPromise1Detail:  "仲介業者の免許を国土交通省データベースで照合済み",
    trustPromise2Detail:  "アップロードされた書類を公開データベースと照合",
    trustPromise3Detail:  "各ステップが証拠記録として保存され、確認可能",
    trustPromise4Detail:  "既知のリスクと未評価の要因を明示",
    trustPromise5Detail:  "データは暗号化して送信。元の内容は第三者と共有しません",
    trustDashboardTitle:      "信頼ダッシュボード",
    trustDashboardSubtitle:   "アップロード内容に基づき、以下の項目を確認しました",
    trustDashboardDisclaimer: "分析はスクリーンショットの内容のみに基づきます。署名前に専門家にご確認ください。",
    trustStatusVerified:      "確認済み",
    trustStatusPartial:       "一部確認",
    trustStatusRisk:          "リスク項目",
    trustStatusUnknown:       "判定不可",
    trustStatusPending:       "分析中",
    evidenceTimestampLabel: "この分析にはタイムスタンプ記録があります",
    evidenceViewDetail:     "証拠サマリーを表示",
    evidenceHashLabel:      "ハッシュダイジェスト",
    evidenceVerifyMethod:   "ファイルの整合性を検証する方法",
    evidenceWriteFailed:    "証拠記録の書き込みに失敗しました。サポートにお問い合わせください。",
    transparencyTitle:       "この分析の技術的透明性",
    transparencyEngine:      "分析エンジン",
    transparencyConfidence:  "信頼度",
    transparencyDataSources: "データソース",
    engineTierA:             "直接一致（完全キーワード）",
    engineTierB:             "意味的一致（知識ベース）",
    engineTierC:             "AI推論（LLM支援、正確ではない場合あり）",
    confidenceHigh:          "高",
    confidenceMedium:        "中",
    confidenceLow:           "やや低い（画像品質が抽出精度に影響）",
    confirmSendScope:    "以下の情報をエージェントに送信します",
    confirmNotSend:      "送信しない",
    confirmModifyScope:  "送信範囲を変更",
    riskLow:      "リスク低め——以下の項目を確認してから進めてください",
    riskMedium:   "一部要確認——専門家の確認をお勧めします",
    riskHigh:     "重要なリスク項目を検出——専門家の確認を強く推奨",
    riskUnknown:  "情報不足——詳細を追加するかエージェントにご連絡ください",
    trustCenterNavLabel: "信頼センター",
    verifyNavLabel:      "記録を検証",
    footerComplianceNote:  "本プラットフォームは法律、税務、投資に関する助言を提供しません。分析結果は参考情報としてのみご利用ください。",
    footerReportViolation: "違反を報告",
    footerEvidenceVerify:  "証拠照会",

    lossAversionText:      "日本では外国人の39.3%が国籍を理由に賃貸を断られた経験があります（法務省データ）",
    lossAversionSource:    "法務省",

    analysisTimestampNote: "この分析結果にはタイムスタンプ記録が生成され、今後の検証に利用できます",

    viewTrustDashboard:    "信頼ダッシュボードを見る",

    trustAction1Label:     "国土交通省で確認 ↗",
    trustAction2aLabel:    "検証方法を確認",
    trustAction2bLabel:    "証拠記録を見る",
    trustAction3Label:     "操作履歴を見る",
    trustAction3LoginHint: "ログインが必要",
    trustAction4Label:     "リスク評価方法を見る",
    trustAction5aLabel:    "プライバシーポリシー",
    trustAction5bLabel:    "データ削除を申請",

    transparencyDisclaimer:   "上記は技術的透明性のための情報であり、「参考情報」の性質を変えるものではありません",
    transparencyExpandLabel:  "展開",
    transparencyAnalysisTime: "分析時間",
    transparencyEvidenceHash: "証拠ダイジェスト",
    transparencyViewFull:     "全文を見る",

    confirmSendItem1:     "分析スクリーンショットのサムネイル",
    confirmSendItem2:     "AI分析の要約（原文ではない）",
    confirmSendItem3:     "ご質問の内容",
    confirmSendItem4:     "操作タイムスタンプ",
    confirmNotSendItem1:  "元のスクリーンショットファイル",
    confirmNotSendItem2:  "お客様の身元情報（未ログイン時）",
    confirmNotSendItem3:  "デバイス情報",
  },

  // ──────────────────────────────────────────────────────────────────────
  // Tier 2 locales — core sections only (nav, hero, tabs, key UI labels)
  // FAQ content falls back to English. Notice shown in footer.
  // ──────────────────────────────────────────────────────────────────────

  "ko": {
    navLogin:          "로그인",
    navSaved:          "저장된 기록",

    eyebrow:           "일본에 막 오셨나요?",
    heroTitle:         "일본에서 집 찾기, 계약, 생활 문제\n단계별로 도와드립니다",
    heroSub:           "일본어 몰라도 됩니다 · 중국어·영어 지원 · 무료로 시작",

    card1Label:        "매물 보기\nAI 분석 받기",
    card1Hint:         "스크린샷·링크·텍스트 → AI 분석 → 상담원 연결",
    card2Label:        "임대 전체 흐름\n주의사항 안내",
    card2Hint:         "보증금, 계약서, 보증회사",
    card3Label:        "궁금한 게 있다면\n바로 물어보세요",
    card3Hint:         "AI 답변 · 상담원 백업",

    guideTitle:        "「매물 보기」 사용법 (3단계):",
    step1:             "아래 링크를 눌러 AtHome / SUUMO에서 매물 확인",
    step2:             "마음에 드는 매물 스크린샷 찍거나 링크 복사해서 돌아오기",
    step3:             "AI가 주요 내용 분석; 복잡한 질문은 상담원이 처리",

    tabRentPrep:       "임대 기초",
    tabSigning:        "신청·계약",
    tabLiving:         "입주 후",
    tabLife:           "일상생활",

    searchPlaceholder: "검색, 예: 보증금 돌려받을 수 있나요…",
    hotLabel:          "이번 주 인기 질문",

    aiZoneTitle:       "답을 못 찾으셨나요? 직접 물어보세요",
    aiPlaceholder:     "상황을 설명해 주세요, 예: 오사카에서 1K를 찾는 베트남인입니다…",
    aiSendLabel:       "전송",
    aiDisclaimer:      "AI 분석 결과는 참고용입니다. 상세 내용은 매물 페이지 또는 상담원에게 확인하세요.",
    aiQuotaFmt:        "오늘 남은 횟수 {remaining}/{limit}",
    aiQuotaExhausted:  "오늘 한도에 도달했습니다. 자정에 초기화됩니다. 계속하려면 상담원에게 문의하세요.",
    aiThinking:        "분석 중…",
    aiError:           "오류가 발생했습니다. 다시 시도하거나 상담원에게 문의하세요.",
    aiFromKB:          "지식 베이스에서",
    analysisStage1:    "이미지 읽는 중…",
    analysisStage2:    "주요 정보 추출 중…",
    analysisStage3:    "분석 중…",
    analysisThinking:  "매물 정보 분석 중…",
    aiBtnCopy:         "복사",
    aiBtnRetry:        "다시 시도",
    aiBtnContact:      "고객 지원 연락",
    analysisTabScreenshot: "스크린샷",
    analysisTabUrl:        "링크 붙여넣기",
    analysisTabText:       "텍스트로 설명",
    analysisDropHint:      "탭하거나 스크린샷을 여기로 드래그",
    analysisDropFormats:   "JPG, PNG, WebP — 최대 10 MB",
    analysisUrlPlaceholder: "AtHome / SUUMO / LIFULL 매물 URL 붙여넣기",
    analysisUrlNote:       "페이지를 가져와 분석합니다. 결과는 참고용입니다.",
    analysisTextPlaceholder: "본 매물을 설명하세요: 월세, 면적, 역, 건축 연도…",
    analysisTextNote:      "아는 만큼 입력하세요. AI가 정보를 추출합니다.",
    analysisSubmit:        "분석",
    analysisDisclaimer:    "분석 결과는 참고용입니다. 매물 페이지 또는 담당자에게 확인하세요.",
    externalBrowseHint:    "먼저 이 플랫폼에서 매물을 찾은 후 돌아와 분석하세요:",
    faqNoResults:          "결과가 없습니다. 아래 AI 또는 고객 지원을 이용하세요.",
    faqVerified:           "확인됨 {date}",

    trustTitle:        "콘텐츠 출처",
    trust1:            "공개 자료 및 내부 조사 기반",
    trust2:            "법률 조언이 아닙니다. 전문가·공공기관에 확인하세요",
    trust3:            "각 FAQ에 최근 확인 날짜 표시",

    humanTitle:        "상담원에게 문의",
    humanLangBadge:    "중국어·영어 지원",
    humanDesc:         "안내문 이해 불가 · 계약 여부 불확실 · 비용 걱정 → 상담원에게 맡기세요",

    confirmTitle:      "연결 전 확인",
    confirmBody:       "제출하신 내용과 요약을 상담원에게 전달합니다(본 상담에만 사용). 중국어·영어 지원 가능. 이번 상담은 무료입니다.",
    confirmOk:         "전송 확인 — 상담원 연결",
    confirmCancel:     "취소",

    phoneLabel:        "전화 상담 (더 빠름)",
    phoneDesc:         "지원 라인으로 직접 전화하실 수 있습니다. 상담원은 사전에 상황을 파악하지 못합니다. 스크린샷이나 요약을 먼저 공유하려면 온라인 채널을 이용하세요.",

    channelLine:       "LINE",
    channelWechat:     "WeChat",
    channelEmail:      "이메일",
    channelWhatsApp:   "WhatsApp",
    channelPhone:      "전화",

    externalLabel:     "외부 링크",
    externalNote:      "외부 부동산 플랫폼으로 이동합니다. 본 사이트와 제휴 관계 없음.",

    footerDisclaimer:  "본 콘텐츠는 정보 제공 목적이며 법률 조언이 아닙니다. 구체적인 사항은 공공기관 및 전문가에게 확인하세요.",
    footerPrivacy:     "개인정보 처리방침",
    footerTerms:       "이용약관",
    footerTranslation: "번역 품질",

    tier2Notice:       "핵심 콘텐츠가 번역되었습니다. 전체 FAQ는 영어 또는 중국어를 참조하세요.",

    // V6 Trust & Transparency
    trustPromise1:        "신원 확인 가능",
    trustPromise2:        "서류 검증 가능",
    trustPromise3:        "절차 추적 가능",
    trustPromise4:        "위험 설명 가능",
    trustPromise5:        "데이터 보호",
    trustPromise1Detail:  "중개업자 면허를 국토교통성 데이터베이스에서 확인",
    trustPromise2Detail:  "업로드된 서류를 공개 기록과 대조 확인",
    trustPromise3Detail:  "모든 단계가 증거 기록으로 저장되어 확인 가능",
    trustPromise4Detail:  "알려진 위험과 미평가 요소를 명시적으로 표시",
    trustPromise5Detail:  "데이터는 암호화하여 전송. 원본 내용은 제3자와 공유하지 않음",
    trustDashboardTitle:      "신뢰 대시보드",
    trustDashboardSubtitle:   "업로드 내용을 기반으로 다음 항목을 검토했습니다",
    trustDashboardDisclaimer: "분석은 스크린샷 내용만을 기반으로 합니다. 서명 전 전문가에게 확인하세요.",
    trustStatusVerified:      "확인됨",
    trustStatusPartial:       "부분 확인",
    trustStatusRisk:          "위험 항목",
    trustStatusUnknown:       "판정 불가",
    trustStatusPending:       "분석 중",
    evidenceTimestampLabel: "이 분석에는 타임스탬프 기록이 있습니다",
    evidenceViewDetail:     "증거 요약 보기",
    evidenceHashLabel:      "해시 다이제스트",
    evidenceVerifyMethod:   "파일 무결성 검증 방법",
    evidenceWriteFailed:    "증거 기록 기록 실패 — 고객 지원에 문의하세요",
    transparencyTitle:       "이 분석의 기술적 투명성",
    transparencyEngine:      "분석 엔진",
    transparencyConfidence:  "신뢰도",
    transparencyDataSources: "데이터 소스",
    engineTierA:             "직접 일치 (정확한 키워드)",
    engineTierB:             "의미적 일치 (지식 베이스)",
    engineTierC:             "AI 추론 (LLM 지원, 정확하지 않을 수 있음)",
    confidenceHigh:          "높음",
    confidenceMedium:        "보통",
    confidenceLow:           "낮음 (이미지 품질이 추출 정확도에 영향)",
    confirmSendScope:    "다음 정보를 에이전트에게 전송합니다",
    confirmNotSend:      "전송하지 않음",
    confirmModifyScope:  "전송 범위 수정",
    riskLow:      "위험 낮음 — 아래 항목을 확인한 후 진행하세요",
    riskMedium:   "일부 항목 주의 필요 — 전문가 검토를 권장합니다",
    riskHigh:     "중요한 위험 항목 발견 — 전문가 검토를 강력히 권장",
    riskUnknown:  "정보 부족 — 세부 정보를 추가하거나 에이전트에게 문의하세요",
    trustCenterNavLabel: "신뢰 센터",
    verifyNavLabel:      "기록 검증",
    footerComplianceNote:  "본 플랫폼은 법률, 세무 또는 투자 조언을 제공하지 않습니다. 분석 결과는 참고용입니다.",
    footerReportViolation: "위반 신고",
    footerEvidenceVerify:  "증거 조회",

    lossAversionText:      "일본에서 외국인의 39.3%가 국적을 이유로 임대를 거절당한 경험이 있습니다 (법무성 데이터)",
    lossAversionSource:    "법무성",
    analysisTimestampNote: "이 분석 결과에는 향후 검증을 위한 타임스탬프 기록이 생성됩니다",
    viewTrustDashboard:    "신뢰 대시보드 보기",
    trustAction1Label:     "국토교통성 확인 ↗",
    trustAction2aLabel:    "검증 방법 확인",
    trustAction2bLabel:    "증거 기록 보기",
    trustAction3Label:     "작업 이력 보기",
    trustAction3LoginHint: "로그인 필요",
    trustAction4Label:     "위험 평가 방법 보기",
    trustAction5aLabel:    "개인정보 처리방침",
    trustAction5bLabel:    "데이터 삭제 요청",
    transparencyDisclaimer:   "위 정보는 기술적 투명성을 위한 것이며 '참고용'의 성격을 변경하지 않습니다",
    transparencyExpandLabel:  "펼치기",
    transparencyAnalysisTime: "분석 시간",
    transparencyEvidenceHash: "증거 다이제스트",
    transparencyViewFull:     "전체 보기",
    confirmSendItem1:     "분석 스크린샷 썸네일",
    confirmSendItem2:     "AI 분석 요약 (원문 아님)",
    confirmSendItem3:     "질문 내용",
    confirmSendItem4:     "작업 타임스탬프",
    confirmNotSendItem1:  "원본 스크린샷 파일",
    confirmNotSendItem2:  "신원 정보 (미로그인 시)",
    confirmNotSendItem3:  "기기 정보",
  },

  "vi": {
    navLogin:          "Đăng nhập",
    navSaved:          "Đã lưu",

    eyebrow:           "Mới đến Nhật?",
    heroTitle:         "Tìm nhà, hiểu hợp đồng,\ngiải quyết cuộc sống ở Nhật",
    heroSub:           "Không cần tiếng Nhật · Hỗ trợ tiếng Việt, Trung, Anh · Miễn phí",

    card1Label:        "Xem nhà trước\nAI phân tích giúp bạn",
    card1Hint:         "Ảnh chụp / link / mô tả → AI đọc → hỗ trợ từ người thật",
    card2Label:        "Hướng dẫn thuê nhà\nTránh các bẫy phổ biến",
    card2Hint:         "Tiền đặt cọc, hợp đồng, công ty bảo lãnh",
    card3Label:        "Có câu hỏi?\nHỏi ngay",
    card3Hint:         "AI trả lời · Người hỗ trợ dự phòng",

    guideTitle:        "Cách dùng \"Xem nhà trước\" (3 bước):",
    step1:             "Nhấn link bên dưới để xem nhà trên AtHome / SUUMO",
    step2:             "Thấy nhà ưng ý → chụp màn hình hoặc dán link về đây",
    step3:             "AI hỗ trợ đọc thông tin; câu hỏi phức tạp có người thật giải đáp",

    tabRentPrep:       "Chuẩn bị thuê",
    tabSigning:        "Đăng ký & ký hợp đồng",
    tabLiving:         "Sau khi dọn vào",
    tabLife:           "Cuộc sống",

    searchPlaceholder: "Tìm kiếm, ví dụ: có lấy lại tiền đặt cọc không…",
    hotLabel:          "Được hỏi nhiều nhất tuần này",

    aiZoneTitle:       "Không tìm thấy câu trả lời? Hỏi trực tiếp",
    aiPlaceholder:     "Mô tả tình huống của bạn, ví dụ: tôi là người Việt muốn thuê 1K ở Osaka…",
    aiSendLabel:       "Gửi",
    aiDisclaimer:      "Kết quả phân tích chỉ mang tính tham khảo. Vui lòng xác nhận với trang nhà hoặc người hỗ trợ.",
    aiQuotaFmt:        "Còn {remaining}/{limit} lượt hôm nay",
    aiQuotaExhausted:  "Đã hết lượt hôm nay. Đặt lại lúc nửa đêm. Liên hệ người hỗ trợ để tiếp tục.",
    aiThinking:        "Đang phân tích…",
    aiError:           "Đã xảy ra lỗi. Vui lòng thử lại hoặc liên hệ người hỗ trợ.",
    aiFromKB:          "Từ cơ sở kiến thức",
    analysisStage1:    "Đang đọc ảnh…",
    analysisStage2:    "Đang trích xuất thông tin…",
    analysisStage3:    "Đang phân tích…",
    analysisThinking:  "Đang đọc thông tin nhà…",
    aiBtnCopy:         "Sao chép",
    aiBtnRetry:        "Thử lại",
    aiBtnContact:      "Liên hệ hỗ trợ",
    analysisTabScreenshot: "Ảnh chụp màn hình",
    analysisTabUrl:        "Dán liên kết",
    analysisTabText:       "Mô tả bằng văn bản",
    analysisDropHint:      "Nhấn hoặc kéo ảnh chụp màn hình vào đây",
    analysisDropFormats:   "JPG, PNG, WebP — tối đa 10 MB",
    analysisUrlPlaceholder: "Dán URL bất động sản từ AtHome / SUUMO / LIFULL",
    analysisUrlNote:       "Trang sẽ được tải và phân tích. Kết quả chỉ mang tính tham khảo.",
    analysisTextPlaceholder: "Mô tả bất động sản bạn thấy: tiền thuê, diện tích, ga tàu, tuổi tòa nhà…",
    analysisTextNote:      "Nhập bao nhiêu cũng được. AI sẽ cố trích xuất thông tin.",
    analysisSubmit:        "Phân tích",
    analysisDisclaimer:    "Kết quả phân tích chỉ mang tính tham khảo — hãy xác minh với trang gốc hoặc nhân viên hỗ trợ.",
    externalBrowseHint:    "Duyệt trên các nền tảng này, sau đó quay lại phân tích:",
    faqNoResults:          "Không có kết quả — thử AI bên dưới hoặc liên hệ hỗ trợ.",
    faqVerified:           "Đã xác minh {date}",

    trustTitle:        "Về nội dung",
    trust1:            "Dựa trên tài liệu công khai và nghiên cứu nội bộ",
    trust2:            "Không phải tư vấn pháp lý — tham khảo nguồn chính thức và chuyên gia",
    trust3:            "Mỗi FAQ hiển thị ngày xác minh gần nhất",

    humanTitle:        "Liên hệ người hỗ trợ",
    humanLangBadge:    "Hỗ trợ tiếng Việt, Trung, Anh",
    humanDesc:         "Không hiểu thông báo · không chắc có ký không · lo về chi phí → giao cho người thật",

    confirmTitle:      "Xác nhận trước khi kết nối",
    confirmBody:       "Chúng tôi sẽ gửi nội dung bạn đã gửi và tóm tắt câu hỏi cho nhân viên hỗ trợ — chỉ dùng cho lần tư vấn này. Tư vấn miễn phí.",
    confirmOk:         "Xác nhận gửi — kết nối nhân viên",
    confirmCancel:     "Hủy",

    phoneLabel:        "Gọi điện trực tiếp (nhanh hơn)",
    phoneDesc:         "Bạn có thể gọi thẳng đường dây hỗ trợ. Nhân viên sẽ chưa biết tình huống của bạn trước đó. Nếu muốn họ xem ảnh chụp hoặc tóm tắt trước, hãy dùng kênh trực tuyến.",

    channelLine:       "LINE",
    channelWechat:     "WeChat",
    channelEmail:      "Email",
    channelWhatsApp:   "WhatsApp",
    channelPhone:      "Điện thoại",

    externalLabel:     "Liên kết ngoài",
    externalNote:      "Chuyển đến nền tảng bất động sản bên ngoài. Không liên kết với trang này.",

    footerDisclaimer:  "Nội dung chỉ mang tính thông tin và không phải tư vấn pháp lý. Tham khảo cơ quan chức năng và chuyên gia cho các vấn đề cụ thể.",
    footerPrivacy:     "Chính sách bảo mật",
    footerTerms:       "Điều khoản dịch vụ",
    footerTranslation: "Chất lượng dịch thuật",

    tier2Notice:       "Nội dung cốt lõi đã được dịch. Xem đầy đủ FAQ bằng tiếng Anh hoặc tiếng Trung.",

    // V6 Trust & Transparency
    trustPromise1:        "Danh tính có thể xác minh",
    trustPromise2:        "Tài liệu có thể xác thực",
    trustPromise3:        "Quy trình có thể theo dõi",
    trustPromise4:        "Rủi ro có thể giải thích",
    trustPromise5:        "Dữ liệu được bảo vệ",
    trustPromise1Detail:  "Giấy phép môi giới đã được xác minh qua CSDL Bộ GTVT",
    trustPromise2Detail:  "Tài liệu tải lên được đối chiếu với hồ sơ công khai",
    trustPromise3Detail:  "Mỗi bước đều được ghi nhận bằng chứng, có thể xem lại",
    trustPromise4Detail:  "Rủi ro đã biết và yếu tố chưa đánh giá được liệt kê rõ ràng",
    trustPromise5Detail:  "Dữ liệu được mã hóa khi truyền. Nội dung gốc không chia sẻ với bên thứ ba",
    trustDashboardTitle:      "Bảng tin cậy",
    trustDashboardSubtitle:   "Dựa trên nội dung bạn tải lên, các mục sau đã được xem xét",
    trustDashboardDisclaimer: "Phân tích chỉ dựa trên ảnh chụp màn hình. Xác minh với chuyên gia trước khi ký.",
    trustStatusVerified:      "Đã xác nhận",
    trustStatusPartial:       "Xác nhận một phần",
    trustStatusRisk:          "Mục rủi ro",
    trustStatusUnknown:       "Không thể xác định",
    trustStatusPending:       "Đang phân tích",
    evidenceTimestampLabel: "Phân tích này có bản ghi dấu thời gian",
    evidenceViewDetail:     "Xem tóm tắt bằng chứng",
    evidenceHashLabel:      "Mã băm",
    evidenceVerifyMethod:   "Cách xác minh tính toàn vẹn của tệp",
    evidenceWriteFailed:    "Ghi bản ghi bằng chứng thất bại — vui lòng liên hệ hỗ trợ",
    transparencyTitle:       "Minh bạch kỹ thuật cho phân tích này",
    transparencyEngine:      "Công cụ phân tích",
    transparencyConfidence:  "Mức độ tin cậy",
    transparencyDataSources: "Nguồn dữ liệu",
    engineTierA:             "Khớp trực tiếp (từ khóa chính xác)",
    engineTierB:             "Khớp ngữ nghĩa (cơ sở tri thức)",
    engineTierC:             "Suy luận AI (hỗ trợ LLM, không chính xác)",
    confidenceHigh:          "Cao",
    confidenceMedium:        "Trung bình",
    confidenceLow:           "Thấp hơn (chất lượng ảnh ảnh hưởng độ chính xác)",
    confirmSendScope:    "Chúng tôi sẽ gửi thông tin sau cho đại lý",
    confirmNotSend:      "Không gửi",
    confirmModifyScope:  "Sửa đổi phạm vi gửi",
    riskLow:      "Rủi ro thấp — xem xét các mục bên dưới trước khi tiếp tục",
    riskMedium:   "Một số mục cần chú ý — nên xem xét với chuyên gia",
    riskHigh:     "Phát hiện mục rủi ro quan trọng — khuyến nghị xem xét chuyên nghiệp",
    riskUnknown:  "Thiếu thông tin — thêm chi tiết hoặc liên hệ đại lý",
    trustCenterNavLabel: "Trung tâm tin cậy",
    verifyNavLabel:      "Xác minh hồ sơ",
    footerComplianceNote:  "Nền tảng này không cung cấp tư vấn pháp lý, thuế hoặc đầu tư. Kết quả phân tích chỉ mang tính tham khảo.",
    footerReportViolation: "Báo cáo vi phạm",
    footerEvidenceVerify:  "Xác minh bằng chứng",

    lossAversionText:      "Tại Nhật, 39,3% cư dân nước ngoài từng bị từ chối thuê nhà vì quốc tịch (dữ liệu Bộ Tư pháp)",
    lossAversionSource:    "Bộ Tư pháp",
    analysisTimestampNote: "Kết quả phân tích này sẽ tạo bản ghi dấu thời gian để bạn xác minh sau",
    viewTrustDashboard:    "Xem bảng tin cậy",
    trustAction1Label:     "Kiểm tra MLIT ↗",
    trustAction2aLabel:    "Tìm hiểu phương pháp xác minh",
    trustAction2bLabel:    "Xem hồ sơ bằng chứng",
    trustAction3Label:     "Xem lịch sử thao tác",
    trustAction3LoginHint: "Cần đăng nhập",
    trustAction4Label:     "Xem phương pháp đánh giá rủi ro",
    trustAction5aLabel:    "Chính sách bảo mật",
    trustAction5bLabel:    "Yêu cầu xóa dữ liệu",
    transparencyDisclaimer:   "Thông tin trên nhằm minh bạch kỹ thuật, không thay đổi tính chất 'tham khảo'",
    transparencyExpandLabel:  "Mở rộng",
    transparencyAnalysisTime: "Thời gian phân tích",
    transparencyEvidenceHash: "Tóm tắt bằng chứng",
    transparencyViewFull:     "Xem đầy đủ",
    confirmSendItem1:     "Hình thu nhỏ ảnh chụp phân tích",
    confirmSendItem2:     "Tóm tắt phân tích AI (không phải văn bản gốc)",
    confirmSendItem3:     "Nội dung câu hỏi của bạn",
    confirmSendItem4:     "Dấu thời gian thao tác",
    confirmNotSendItem1:  "Tệp ảnh chụp gốc",
    confirmNotSendItem2:  "Thông tin danh tính (khi chưa đăng nhập)",
    confirmNotSendItem3:  "Thông tin thiết bị",
  },

  "th": {
    navLogin:          "เข้าสู่ระบบ",
    navSaved:          "บันทึกแล้ว",

    eyebrow:           "เพิ่งมาถึงญี่ปุ่น?",
    heroTitle:         "หาบ้าน เข้าใจสัญญา แก้ปัญหาชีวิต\nในญี่ปุ่น เราช่วยได้",
    heroSub:           "ไม่ต้องรู้ภาษาญี่ปุ่น · รองรับภาษาไทย จีน อังกฤษ · ฟรี",

    card1Label:        "ดูห้องก่อน\nให้ AI ช่วยวิเคราะห์",
    card1Hint:         "สกรีนช็อต / ลิงก์ / ข้อความ → AI วิเคราะห์ → ติดตามโดยทีมงาน",
    card2Label:        "ขั้นตอนเช่า\nหลีกเลี่ยงกับดัก",
    card2Hint:         "เงินมัดจำ สัญญา บริษัทค้ำประกัน",
    card3Label:        "มีคำถาม?\nถามเลย",
    card3Hint:         "AI ตอบ · ทีมงานสำรอง",

    guideTitle:        "วิธีใช้ \"ดูห้องก่อน\" (3 ขั้นตอน):",
    step1:             "คลิกลิงก์ด้านล่างเพื่อดูห้องบน AtHome / SUUMO",
    step2:             "เจอห้องที่ชอบ → สกรีนช็อตหรือวางลิงก์กลับมา",
    step3:             "AI ช่วยอ่านข้อมูลหลัก; คำถามซับซ้อนมีทีมงานดูแล",

    tabRentPrep:       "พื้นฐานการเช่า",
    tabSigning:        "สมัครและเซ็นสัญญา",
    tabLiving:         "หลังย้ายเข้า",
    tabLife:           "ชีวิตประจำวัน",

    searchPlaceholder: "ค้นหา เช่น คืนเงินมัดจำได้ไหม…",
    hotLabel:          "ถามมากที่สุดสัปดาห์นี้",

    aiZoneTitle:       "ไม่พบคำตอบ? ถามได้เลย",
    aiPlaceholder:     "อธิบายสถานการณ์ เช่น ฉันเป็นคนไทยอยากเช่า 1K ที่โอซาก้า…",
    aiSendLabel:       "ส่ง",
    aiDisclaimer:      "ผลการวิเคราะห์เพื่ออ้างอิงเท่านั้น กรุณาตรวจสอบกับหน้าประกาศหรือทีมงาน",
    aiQuotaFmt:        "เหลือ {remaining}/{limit} ครั้งวันนี้",
    aiQuotaExhausted:  "ใช้ครบโควต้าวันนี้แล้ว รีเซ็ตเที่ยงคืน ติดต่อทีมงานเพื่อดำเนินการต่อ",
    aiThinking:        "กำลังวิเคราะห์…",
    aiError:           "เกิดข้อผิดพลาด โปรดลองอีกครั้งหรือติดต่อเจ้าหน้าที่",
    aiFromKB:          "จากฐานความรู้",
    analysisStage1:    "กำลังอ่านรูปภาพ…",
    analysisStage2:    "กำลังดึงข้อมูลสำคัญ…",
    analysisStage3:    "กำลังวิเคราะห์…",
    analysisThinking:  "กำลังอ่านข้อมูลห้อง…",
    aiBtnCopy:         "คัดลอก",
    aiBtnRetry:        "ลองอีกครั้ง",
    aiBtnContact:      "ติดต่อฝ่ายสนับสนุน",
    analysisTabScreenshot: "ภาพหน้าจอ",
    analysisTabUrl:        "วางลิงก์",
    analysisTabText:       "อธิบายเป็นข้อความ",
    analysisDropHint:      "แตะหรือลากภาพหน้าจอมาที่นี่",
    analysisDropFormats:   "JPG, PNG, WebP — สูงสุด 10 MB",
    analysisUrlPlaceholder: "วาง URL ห้องจาก AtHome / SUUMO / LIFULL",
    analysisUrlNote:       "ระบบจะดึงหน้าเว็บมาวิเคราะห์ ผลลัพธ์เป็นข้อมูลอ้างอิงเท่านั้น",
    analysisTextPlaceholder: "อธิบายห้องที่คุณเห็น: ค่าเช่า ขนาด สถานี อายุอาคาร…",
    analysisTextNote:      "พิมพ์ได้ตามที่รู้ AI จะพยายามดึงข้อมูลสำคัญ",
    analysisSubmit:        "วิเคราะห์",
    analysisDisclaimer:    "ผลการวิเคราะห์เป็นข้อมูลอ้างอิงเท่านั้น กรุณาตรวจสอบกับหน้าประกาศหรือเจ้าหน้าที่",
    externalBrowseHint:    "เรียกดูบนแพลตฟอร์มเหล่านี้แล้วกลับมาวิเคราะห์:",
    faqNoResults:          "ไม่พบผลลัพธ์ — ลองใช้ AI ด้านล่างหรือติดต่อฝ่ายสนับสนุน",
    faqVerified:           "ยืนยันแล้ว {date}",

    trustTitle:        "เกี่ยวกับเนื้อหา",
    trust1:            "อ้างอิงจากข้อมูลสาธารณะและการวิจัยภายใน",
    trust2:            "ไม่ใช่คำแนะนำทางกฎหมาย — ปรึกษาผู้เชี่ยวชาญและหน่วยงานราชการ",
    trust3:            "แต่ละ FAQ แสดงวันที่ตรวจสอบล่าสุด",

    humanTitle:        "ติดต่อเจ้าหน้าที่",
    humanLangBadge:    "รองรับภาษาไทย จีน อังกฤษ",
    humanDesc:         "อ่านประกาศไม่ออก · ไม่แน่ใจว่าจะเซ็นดี · กังวลเรื่องค่าใช้จ่าย → ฝากเจ้าหน้าที่ดูแล",

    confirmTitle:      "ยืนยันก่อนเชื่อมต่อ",
    confirmBody:       "เราจะส่งเนื้อหาที่คุณส่งมาและสรุปคำถามให้เจ้าหน้าที่ — ใช้สำหรับการปรึกษาครั้งนี้เท่านั้น ปรึกษาฟรี",
    confirmOk:         "ยืนยันส่งข้อมูล — เชื่อมต่อเจ้าหน้าที่",
    confirmCancel:     "ยกเลิก",

    phoneLabel:        "โทรปรึกษาตรง (เร็วกว่า)",
    phoneDesc:         "โทรตรงไปยังสายซัพพอร์ต เจ้าหน้าที่จะยังไม่ทราบบริบทของคุณล่วงหน้า หากต้องการให้ดูสกรีนช็อตหรือสรุปก่อน ใช้ช่องทางออนไลน์แทน",

    channelLine:       "LINE",
    channelWechat:     "WeChat",
    channelEmail:      "อีเมล",
    channelWhatsApp:   "WhatsApp",
    channelPhone:      "โทรศัพท์",

    externalLabel:     "ลิงก์ภายนอก",
    externalNote:      "ไปยังแพลตฟอร์มอสังหาริมทรัพย์ภายนอก ไม่มีความสัมพันธ์กับเว็บไซต์นี้",

    footerDisclaimer:  "เนื้อหาเพื่อให้ข้อมูลเท่านั้น ไม่ใช่คำแนะนำทางกฎหมาย ปรึกษาหน่วยงานและผู้เชี่ยวชาญสำหรับกรณีเฉพาะ",
    footerPrivacy:     "นโยบายความเป็นส่วนตัว",
    footerTerms:       "ข้อกำหนดการใช้งาน",
    footerTranslation: "คุณภาพการแปล",

    tier2Notice:       "เนื้อหาหลักได้รับการแปลแล้ว ดู FAQ ฉบับเต็มเป็นภาษาอังกฤษหรือจีน",

    // V6 Trust & Transparency
    trustPromise1:        "ยืนยันตัวตนได้",
    trustPromise2:        "เอกสารตรวจสอบได้",
    trustPromise3:        "กระบวนการติดตามได้",
    trustPromise4:        "อธิบายความเสี่ยงได้",
    trustPromise5:        "ข้อมูลได้รับการปกป้อง",
    trustPromise1Detail:  "ใบอนุญาตนายหน้าตรวจสอบผ่านฐานข้อมูลกระทรวงที่ดิน",
    trustPromise2Detail:  "เอกสารที่อัปโหลดตรวจสอบกับบันทึกสาธารณะ",
    trustPromise3Detail:  "ทุกขั้นตอนบันทึกเป็นหลักฐานที่คุณตรวจสอบได้",
    trustPromise4Detail:  "ความเสี่ยงที่ทราบและปัจจัยที่ยังไม่ประเมินแสดงไว้ชัดเจน",
    trustPromise5Detail:  "ข้อมูลเข้ารหัสในการส่ง เนื้อหาต้นฉบับไม่แชร์กับบุคคลที่สาม",
    trustDashboardTitle:      "แดชบอร์ดความน่าเชื่อถือ",
    trustDashboardSubtitle:   "จากเนื้อหาที่คุณอัปโหลด รายการต่อไปนี้ได้รับการตรวจสอบ",
    trustDashboardDisclaimer: "การวิเคราะห์อ้างอิงจากภาพหน้าจอเท่านั้น กรุณาตรวจสอบกับผู้เชี่ยวชาญก่อนลงนาม",
    trustStatusVerified:      "ยืนยันแล้ว",
    trustStatusPartial:       "ยืนยันบางส่วน",
    trustStatusRisk:          "รายการเสี่ยง",
    trustStatusUnknown:       "ไม่สามารถระบุได้",
    trustStatusPending:       "กำลังวิเคราะห์",
    evidenceTimestampLabel: "การวิเคราะห์นี้มีบันทึกเวลาประทับ",
    evidenceViewDetail:     "ดูสรุปหลักฐาน",
    evidenceHashLabel:      "แฮชไดเจสต์",
    evidenceVerifyMethod:   "วิธีตรวจสอบความสมบูรณ์ของไฟล์",
    evidenceWriteFailed:    "บันทึกหลักฐานล้มเหลว — กรุณาติดต่อฝ่ายสนับสนุน",
    transparencyTitle:       "ความโปร่งใสทางเทคนิคสำหรับการวิเคราะห์นี้",
    transparencyEngine:      "เอ็นจิ้นวิเคราะห์",
    transparencyConfidence:  "ระดับความเชื่อมั่น",
    transparencyDataSources: "แหล่งข้อมูล",
    engineTierA:             "จับคู่โดยตรง (คำสำคัญที่แน่นอน)",
    engineTierB:             "จับคู่ความหมาย (ฐานความรู้)",
    engineTierC:             "การให้เหตุผล AI (ช่วยโดย LLM ไม่แม่นยำ)",
    confidenceHigh:          "สูง",
    confidenceMedium:        "ปานกลาง",
    confidenceLow:           "ต่ำกว่า (คุณภาพภาพมีผลต่อความแม่นยำในการดึงข้อมูล)",
    confirmSendScope:    "เราจะส่งข้อมูลต่อไปนี้ให้ตัวแทน",
    confirmNotSend:      "ไม่ส่ง",
    confirmModifyScope:  "แก้ไขขอบเขตการส่ง",
    riskLow:      "ความเสี่ยงต่ำ — ตรวจสอบรายการด้านล่างก่อนดำเนินการ",
    riskMedium:   "บางรายการต้องใส่ใจ — แนะนำให้ผู้เชี่ยวชาญตรวจสอบ",
    riskHigh:     "พบรายการเสี่ยงสำคัญ — แนะนำอย่างยิ่งให้ผู้เชี่ยวชาญตรวจสอบ",
    riskUnknown:  "ข้อมูลไม่เพียงพอ — เพิ่มรายละเอียดหรือติดต่อตัวแทน",
    trustCenterNavLabel: "ศูนย์ความน่าเชื่อถือ",
    verifyNavLabel:      "ตรวจสอบบันทึก",
    footerComplianceNote:  "แพลตฟอร์มนี้ไม่ให้คำแนะนำทางกฎหมาย ภาษี หรือการลงทุน ผลวิเคราะห์ใช้เพื่อการอ้างอิงเท่านั้น",
    footerReportViolation: "แจ้งการละเมิด",
    footerEvidenceVerify:  "ตรวจสอบหลักฐาน",

    lossAversionText:      "ในญี่ปุ่น 39.3% ของชาวต่างชาติเคยถูกปฏิเสธการเช่าเนื่องจากสัญชาติ (ข้อมูลกระทรวงยุติธรรม)",
    lossAversionSource:    "กระทรวงยุติธรรม",
    analysisTimestampNote: "ผลการวิเคราะห์นี้จะสร้างบันทึกเวลาประทับเพื่อการตรวจสอบในอนาคต",
    viewTrustDashboard:    "ดูแดชบอร์ดความน่าเชื่อถือ",
    trustAction1Label:     "ตรวจสอบ MLIT ↗",
    trustAction2aLabel:    "เรียนรู้วิธีตรวจสอบ",
    trustAction2bLabel:    "ดูบันทึกหลักฐาน",
    trustAction3Label:     "ดูประวัติการทำงาน",
    trustAction3LoginHint: "ต้องเข้าสู่ระบบ",
    trustAction4Label:     "ดูวิธีประเมินความเสี่ยง",
    trustAction5aLabel:    "นโยบายความเป็นส่วนตัว",
    trustAction5bLabel:    "ขอลบข้อมูล",
    transparencyDisclaimer:   "ข้อมูลข้างต้นมีไว้เพื่อความโปร่งใสทางเทคนิค ไม่เปลี่ยนแปลงลักษณะ 'เพื่อการอ้างอิง'",
    transparencyExpandLabel:  "ขยาย",
    transparencyAnalysisTime: "เวลาวิเคราะห์",
    transparencyEvidenceHash: "สรุปหลักฐาน",
    transparencyViewFull:     "ดูทั้งหมด",
    confirmSendItem1:     "ภาพขนาดย่อของภาพหน้าจอวิเคราะห์",
    confirmSendItem2:     "สรุปการวิเคราะห์ AI (ไม่ใช่ข้อความต้นฉบับ)",
    confirmSendItem3:     "เนื้อหาคำถามของคุณ",
    confirmSendItem4:     "เวลาประทับการดำเนินงาน",
    confirmNotSendItem1:  "ไฟล์ภาพหน้าจอต้นฉบับ",
    confirmNotSendItem2:  "ข้อมูลตัวตนของคุณ (เมื่อยังไม่เข้าสู่ระบบ)",
    confirmNotSendItem3:  "ข้อมูลอุปกรณ์",
  },
};

/** Resolve copy for a locale, falling back to English for any missing keys. */
export function getCopy(locale: Locale | string): HomepageCopy {
  return copy[locale as Locale] ?? copy["en"];
}

/** Format a quota string: replaces {remaining} and {limit} placeholders. */
export function fmtQuota(
  template: string,
  remaining: number,
  limit: number
): string {
  return template
    .replace("{remaining}", String(remaining))
    .replace("{limit}", String(limit));
}
