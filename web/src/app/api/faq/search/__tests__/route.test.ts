/**
 * app/api/faq/search/__tests__/route.test.ts
 *
 * Tests for GET /api/faq/search — merged mock + knowledge base search.
 */

import { GET } from "../route";
import { NextRequest } from "next/server";

function makeRequest(params: Record<string, string>) {
  const url = new URL("http://localhost/api/faq/search");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url);
}

/** Unwrap standardized response: { success, data } → data */
async function unwrap(res: Response) {
  const json = await res.json();
  return json.data ?? json;
}

describe("GET /api/faq/search", () => {
  it("returns empty for blank query", async () => {
    const res = await GET(makeRequest({ q: "" }));
    const data = await unwrap(res);
    expect(data.resultCount).toBe(0);
    expect(data.items).toEqual([]);
  });

  it("returns empty for whitespace-only query", async () => {
    const res = await GET(makeRequest({ q: "   " }));
    const data = await unwrap(res);
    expect(data.resultCount).toBe(0);
  });

  it("matches mock cards by title (zh-Hans)", async () => {
    const res = await GET(makeRequest({ q: "垃圾" }));
    const data = await unwrap(res);
    expect(data.resultCount).toBeGreaterThan(0);

    const titles = data.items.map((i: Record<string, unknown>) => i.title);
    expect(titles.some((t: string) => t.includes("垃圾"))).toBe(true);
  });

  it("matches mock cards by summary", async () => {
    const res = await GET(makeRequest({ q: "押金" }));
    const data = await unwrap(res);
    expect(data.resultCount).toBeGreaterThan(0);
  });

  it("returns knowledge base results for English queries", async () => {
    const res = await GET(makeRequest({ q: "deposit", locale: "en" }));
    const data = await unwrap(res);

    // Knowledge base has "deposit" entries even though mock cards are zh-Hans
    expect(data.resultCount).toBeGreaterThan(0);
    expect(data.locale).toBe("en");
  });

  it("returns knowledge base results for Japanese queries", async () => {
    const res = await GET(makeRequest({ q: "敷金", locale: "ja" }));
    const data = await unwrap(res);
    expect(data.resultCount).toBeGreaterThan(0);
    expect(data.locale).toBe("ja");
  });

  it("filters by category", async () => {
    const res = await GET(makeRequest({ q: "保证", category: "prep" }));
    const data = await unwrap(res);

    for (const item of data.items) {
      expect(item.categoryKey).toBe("prep");
    }
  });

  it("deduplicates results across mock and KB sources", async () => {
    const res = await GET(makeRequest({ q: "押金" }));
    const data = await unwrap(res);

    const ids = data.items.map((i: Record<string, unknown>) => i.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it("defaults locale to zh-Hans", async () => {
    const res = await GET(makeRequest({ q: "test" }));
    const data = await unwrap(res);
    expect(data.locale).toBe("zh-Hans");
  });

  it("includes query in response", async () => {
    const res = await GET(makeRequest({ q: "rent" }));
    const data = await unwrap(res);
    expect(data.query).toBe("rent");
  });

  it("returns items with expected shape", async () => {
    const res = await GET(makeRequest({ q: "deposit", locale: "en" }));
    const data = await unwrap(res);

    if (data.items.length > 0) {
      const item = data.items[0];
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("title");
      expect(item).toHaveProperty("categoryKey");
      expect(typeof item.id).toBe("string");
      expect(typeof item.title).toBe("string");
    }
  });
});
