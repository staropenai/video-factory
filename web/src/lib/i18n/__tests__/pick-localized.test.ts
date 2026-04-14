/**
 * lib/i18n/__tests__/pick-localized.test.ts
 */

import { toLang, pickLocalized } from "../pick-localized";

describe("toLang", () => {
  it("maps zh-Hans and zh to zh", () => {
    expect(toLang("zh-Hans")).toBe("zh");
    expect(toLang("zh")).toBe("zh");
  });

  it("maps ja to ja", () => {
    expect(toLang("ja")).toBe("ja");
  });

  it("falls back to en for other locales", () => {
    expect(toLang("en")).toBe("en");
    expect(toLang("ko")).toBe("en");
    expect(toLang("vi")).toBe("en");
    expect(toLang("th")).toBe("en");
    expect(toLang("fr")).toBe("en");
  });
});

describe("pickLocalized", () => {
  const obj = {
    zh: "你好",
    en: "Hello",
    ja: "こんにちは",
  };

  it("returns the requested language", () => {
    expect(pickLocalized(obj, "zh-Hans")).toBe("你好");
    expect(pickLocalized(obj, "en")).toBe("Hello");
    expect(pickLocalized(obj, "ja")).toBe("こんにちは");
  });

  it("falls back through the chain", () => {
    const onlyZh = { zh: "仅中文" };
    expect(pickLocalized(onlyZh, "ko")).toBe("仅中文");
  });

  it("returns empty string for undefined obj", () => {
    expect(pickLocalized(undefined, "en")).toBe("");
  });
});
