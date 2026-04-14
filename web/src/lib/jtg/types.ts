// JTG Homepage V2 — Type Definitions

export type Locale = "zh-Hans" | "en" | "ja" | "ko" | "vi" | "th";
export type SupportLevel = "full" | "core" | "machine_translated";
export type PlanTier = "free" | "starter" | "pro";

export const LOCALES: Locale[] = ["zh-Hans", "en", "ja", "ko", "vi", "th"];
export const FULL_SUPPORT_LOCALES: Locale[] = ["zh-Hans", "en", "ja"];

export interface PageMeta {
  pageName: "home";
  locale: Locale;
  supportLevel: SupportLevel;
  sessionId: string;
  userId?: string;
  isLoggedIn: boolean;
  planTier: PlanTier;
}

// ZONE 0
export interface NavBarData {
  logoText: string;
  entries: {
    key: "before_japan" | "renting" | "longterm";
    label: string;
    href: string;
  }[];
  currentLocale: Locale;
  localeOptions: {
    code: Locale;
    label: string;
    shortLabel: string;
  }[];
  helpLink: { label: string; href: string };
  accountLink: { label: string; href: string; visible: boolean };
}

// ZONE 1
export interface HeroData {
  title: { line1: string; line2: string };
  subtitle?: string;
  cards: {
    key: "before_japan" | "renting" | "longterm";
    title: string;
    description: string;
    icon: string;
    href: string;
  }[];
}

// ZONE 2
export interface FaqCategory {
  key: "prep" | "apply_contract" | "after_movein" | "cost_checkout" | "buy_longstay";
  label: string;
}

export interface FaqCard {
  id: string;
  categoryKey: FaqCategory["key"];
  title: string;
  summary: string;
  contentTypeLabel: string;
  supportLevel: SupportLevel;
  machineTranslated: boolean;
  href?: string;
}

export interface TrendingItem {
  id: string;
  label: string;
  href: string;
}

export interface FaqZoneData {
  categories: FaqCategory[];
  activeCategoryKey: FaqCategory["key"];
  searchPlaceholder: string;
  searchEmptyState: {
    title: string;
    hints: string[];
    aiLinkLabel: string;
    aiLinkHref: string;
    humanHelpLabel: string;
    humanHelpHref: string;
  };
  trendingItems: TrendingItem[];
  cards: FaqCard[];
}

// ZONE 3
export interface TrustZoneData {
  title: string;
  bullets: string[];
  officialSourceLink?: { label: string; href: string };
  languageCompletenessNote: string;
  disclaimer: string;
}

// ZONE 4
export interface UsageMeter {
  used: number;
  limit: number;
  remaining: number;
  resetAtText: string;
}

export interface UpgradeHint {
  visible: boolean;
  title?: string;
  description?: string;
  ctaLabel?: string;
  ctaHref?: string;
}

export interface AiZoneData {
  title: string;
  description: string;
  inputPlaceholder: string;
  submitLabel: string;
  usage: UsageMeter;
  disabled: boolean;
  disabledReason?: string;
  upgradeHint: UpgradeHint;
}

// ZONE 5
export interface HumanHelpChannel {
  type: "email" | "line" | "whatsapp" | "form";
  label: string;
  value: string;
  href?: string;
}

export interface HumanHelpData {
  title: string;
  description: string;
  scenes: string[];
  responseWindowText: string;
  channels: HumanHelpChannel[];
  ctaLabel: string;
  ctaHref: string;
}

// ZONE 6
export interface FooterData {
  localeNote: string;
  translationQualityNote: string;
  privacyLink: { label: string; href: string };
  termsLink?: { label: string; href: string };
  supportLink?: { label: string; href: string };
}

// Combined homepage response
export interface HomepageConfig {
  pageMeta: PageMeta;
  navBar: NavBarData;
  hero: HeroData;
  faqZone: FaqZoneData;
  trustZone: TrustZoneData;
  aiZone: AiZoneData;
  humanHelp: HumanHelpData;
  footer: FooterData;
}

// Behavior tracking
export type EventType =
  | "page_view"
  | "hero_entry_click"
  | "faq_click"
  | "faq_dwell"
  | "search_submit"
  | "ai_open"
  | "human_help_click"
  | "lang_switch_manual";

export interface BehaviorEvent<T = Record<string, unknown>> {
  eventType: EventType;
  pageName: "home";
  elementId?: string;
  locale: Locale;
  sessionId: string;
  timestamp?: string;
  payload: T;
}

// API responses
export interface FaqSearchResponse {
  query: string;
  locale: Locale;
  resultCount: number;
  items: FaqCard[];
}

export interface UsageTodayResponse {
  planTier: PlanTier;
  ai: UsageMeter;
  bridge: UsageMeter;
}

export interface AiSessionOpenResponse {
  sessionId: string;
  usage: UsageMeter;
  upgradeHint: UpgradeHint;
}
