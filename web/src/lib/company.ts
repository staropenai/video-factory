/**
 * Centralized company identity and trust configuration.
 *
 * Single source of truth for all public-facing company information.
 * Import from here — do not duplicate these values across files.
 */

export const COMPANY = {
  /** Public brand name */
  brand: "Japan Trust Gateway",
  /** Short brand for tight spaces */
  brandShort: "JTG",
  /** Company legal name (Japanese) */
  legalNameJa: "H&L 株式会社",
  /** Company legal name (English) */
  legalNameEn: "H&L Co., Ltd.",
  /** Representative */
  representative: "Iwai Akitoshi",
  /** Registered office address */
  address: {
    postal: "〒160-0023",
    full: "東京都新宿区西新宿7-7-27 第一守徳ビル8階",
    short: "東京都新宿区西新宿7-7-27",
    en: "Daiichi Moritoku Bldg 8F, 7-7-27 Nishi-Shinjuku, Shinjuku-ku, Tokyo 160-0023",
  },
  /** Contact */
  tel: "03-6823-8058",
  fax: "03-6730-1926",
  email: "akitoshi.iwai@hlking-life.jp",
  /** Professional credentials */
  credentials: [
    { ja: "宅地建物取引士", en: "Licensed Real Estate Transaction Specialist" },
    { ja: "賃貸不動産経営管理士", en: "Certified Rental Property Manager" },
  ],
  /** Product positioning */
  tagline: {
    en: "Trusted guidance for foreigners renting and living in Japan",
    zh: "为在日外国人提供可信赖的租房与生活指南",
    ja: "日本で暮らす外国人のための信頼できる住まいガイド",
  },
  /** Service scope description */
  scope: {
    en: "Housing guidance, rental support, and living assistance for foreign residents in Japan",
    zh: "面向在日外国人的住房指南、租房支持与生活帮助",
    ja: "外国人居住者のための住宅ガイド、賃貸サポート、生活支援",
  },
  /** Links */
  links: {
    privacy: "/privacy",
    terms: "/terms",
    support: "/contact",
  },
} as const;

export type Company = typeof COMPANY;
