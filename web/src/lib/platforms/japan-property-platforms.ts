/**
 * src/lib/platforms/japan-property-platforms.ts
 *
 * V5 §4.4 ZONE 3 — External property platform data.
 * Maturity: production-ready
 */

export interface Platform {
  id: string;
  name: string;
  url: string;
  /** One-line description shown on card */
  description: string;
  /** True → show "外国人友好" badge */
  foreignFriendly: boolean;
  /** True → show "支持中文" badge */
  hasChinese: boolean;
}

export const platforms: Platform[] = [
  {
    id: "athome",
    name: "AtHome",
    url: "https://www.athome.co.jp",
    description: "日本大型综合租房平台，房源覆盖广",
    foreignFriendly: false,
    hasChinese: false,
  },
  {
    id: "suumo",
    name: "SUUMO",
    url: "https://suumo.jp",
    description: "日本最大租房平台，房源量最多",
    foreignFriendly: false,
    hasChinese: false,
  },
  {
    id: "lifull",
    name: "LIFULL HOME'S",
    url: "https://www.homes.co.jp",
    description: "支持「外国人可」条件筛选",
    foreignFriendly: true,
    hasChinese: false,
  },
  {
    id: "chintai",
    name: "CHINTAI",
    url: "https://www.chintai.net",
    description: "年轻人和单身租房首选平台",
    foreignFriendly: false,
    hasChinese: false,
  },
  {
    id: "ur",
    name: "UR賃貸",
    url: "https://www.ur-net.go.jp/chintai",
    description: "政府管理公团，无中介费，外国人友好",
    foreignFriendly: true,
    hasChinese: false,
  },
  {
    id: "goodrooms",
    name: "GoodRooms",
    url: "https://www.goodrooms.jp",
    description: "专注外国人友好租房，审查宽松",
    foreignFriendly: true,
    hasChinese: false,
  },
  {
    id: "realestatejapan",
    name: "Real Estate Japan",
    url: "https://realestate.co.jp",
    description: "提供英文/中文界面，外国人首选起点",
    foreignFriendly: true,
    hasChinese: true,
  },
];

/** Platform guide copy per locale (V5 §4.4 three-step guide) */
export const PLATFORM_GUIDE: Record<string, string> = {
  "zh-Hans": "① 点击平台看房源 → ② 复制房源网址 → ③ 回来粘贴到分析框",
  en: "① Browse listings → ② Copy the URL → ③ Paste it here to analyze",
  ja: "① 物件を探す → ② URLをコピー → ③ ここに貼り付けて分析",
};
