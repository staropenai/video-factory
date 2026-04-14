/**
 * lib/security/__tests__/output-validator.test.ts
 *
 * Comprehensive tests for the LLM output safety validator.
 * All functions under test are pure — no mocking needed.
 */

import {
  detectHtmlInjection,
  detectDangerousUrls,
  detectPromptLeak,
  detectPiiExposure,
  detectEncodingAttack,
  sanitizeForRender,
  sanitizeForGraphWriteback,
  sanitizeUrl,
  validateOutput,
  validateBatch,
} from "../output-validator";

// ── detectHtmlInjection ──────────────────────────────────────────

describe("detectHtmlInjection", () => {
  it("detects <script> tag", () => {
    const issues = detectHtmlInjection('<script>alert("xss")</script>');
    expect(issues.length).toBeGreaterThanOrEqual(1);
    expect(issues.some((i) => i.type === "script_injection")).toBe(true);
    expect(issues.some((i) => i.severity === "critical")).toBe(true);
  });

  it("detects case-insensitive <SCRIPT>", () => {
    const issues = detectHtmlInjection("<SCRIPT>bad</SCRIPT>");
    expect(issues.some((i) => i.type === "script_injection")).toBe(true);
  });

  it("detects <iframe> tag", () => {
    const issues = detectHtmlInjection('<iframe src="evil.com">');
    expect(issues.some((i) => i.type === "html_injection")).toBe(true);
    expect(issues[0].severity).toBe("critical");
  });

  it("detects <object> tag", () => {
    const issues = detectHtmlInjection("<object data=evil>");
    expect(issues.some((i) => i.type === "html_injection")).toBe(true);
  });

  it("detects <embed> tag", () => {
    const issues = detectHtmlInjection("<embed src=evil>");
    expect(issues.some((i) => i.type === "html_injection")).toBe(true);
  });

  it("detects <form> tag", () => {
    const issues = detectHtmlInjection('<form action="/steal">');
    expect(issues.some((i) => i.type === "html_injection")).toBe(true);
  });

  it("detects <input> tag", () => {
    const issues = detectHtmlInjection("<input type=hidden>");
    expect(issues.some((i) => i.type === "html_injection")).toBe(true);
    expect(issues[0].severity).toBe("medium");
  });

  it("detects inline event handler (onclick)", () => {
    const issues = detectHtmlInjection('<div onclick="steal()">');
    expect(issues.some((i) => i.type === "script_injection")).toBe(true);
  });

  it("detects various event handlers (onerror, onload)", () => {
    expect(detectHtmlInjection('<img onerror="x">').length).toBeGreaterThan(0);
    expect(detectHtmlInjection('<body onload="x">').length).toBeGreaterThan(0);
  });

  it("detects javascript: protocol", () => {
    const issues = detectHtmlInjection("javascript:alert(1)");
    expect(issues.some((i) => i.type === "script_injection")).toBe(true);
  });

  it("detects data: URI with dangerous MIME type", () => {
    const issues = detectHtmlInjection("data:text/html,<h1>hi</h1>");
    expect(issues.some((i) => i.type === "script_injection")).toBe(true);
  });

  it("returns empty for safe text", () => {
    expect(detectHtmlInjection("The deposit is 2 months of rent.")).toEqual([]);
  });

  it("returns empty for CJK text", () => {
    expect(detectHtmlInjection("敷金は家賃の2ヶ月分です。")).toEqual([]);
  });

  it("includes position info", () => {
    const issues = detectHtmlInjection("hello <script>bad</script>");
    expect(issues[0].position).toBe(6);
  });

  it("handles multiple injections in same text", () => {
    const issues = detectHtmlInjection(
      '<script>a</script><iframe src="x"><form action="y">'
    );
    expect(issues.length).toBeGreaterThanOrEqual(3);
  });
});

// ── detectDangerousUrls ──────────────────────────────────────────

describe("detectDangerousUrls", () => {
  it("detects javascript: protocol in URLs", () => {
    const issues = detectDangerousUrls("Visit javascript:alert(1)");
    expect(issues.some((i) => i.type === "dangerous_url")).toBe(true);
  });

  it("detects file:// protocol in URLs", () => {
    const issues = detectDangerousUrls("Open file:///etc/shadow for details");
    expect(issues.some((i) => i.type === "dangerous_url")).toBe(true);
  });

  it("detects file: protocol", () => {
    const issues = detectDangerousUrls("See file:///etc/passwd");
    expect(issues.some((i) => i.severity === "critical")).toBe(true);
  });

  it("flags phishing TLD (.tk)", () => {
    const issues = detectDangerousUrls("Visit https://evil.tk/login");
    expect(issues.some((i) => i.description.includes("suspicious TLD"))).toBe(true);
  });

  it("flags phishing TLD (.xyz)", () => {
    const issues = detectDangerousUrls("Go to https://scam.xyz/form");
    expect(issues.some((i) => i.description.includes("suspicious TLD"))).toBe(true);
  });

  it("flags excessively long URLs", () => {
    const longUrl = "https://example.com/" + "a".repeat(500);
    const issues = detectDangerousUrls(longUrl);
    expect(issues.some((i) => i.description.includes("Suspiciously long"))).toBe(true);
  });

  it("returns empty for safe HTTPS URL", () => {
    expect(detectDangerousUrls("Visit https://mlit.go.jp/help")).toEqual([]);
  });

  it("returns empty for plain text without URLs", () => {
    expect(detectDangerousUrls("No links here, just text.")).toEqual([]);
  });
});

// ── detectPromptLeak ─────────────────────────────────────────────

describe("detectPromptLeak", () => {
  it('detects "You are a" system prompt pattern', () => {
    const issues = detectPromptLeak("You are a helpful assistant for JTG.");
    expect(issues.some((i) => i.type === "prompt_leak")).toBe(true);
  });

  it('detects "System:" pattern', () => {
    const issues = detectPromptLeak("System: You must always answer in Japanese.");
    expect(issues.length).toBeGreaterThan(0);
  });

  it("detects <<SYS>> tag", () => {
    const issues = detectPromptLeak("<<SYS>>You are a...<</SYS>>");
    expect(issues.length).toBeGreaterThan(0);
  });

  it("detects [INST] tag", () => {
    const issues = detectPromptLeak("[INST] Answer the question [/INST]");
    expect(issues.length).toBeGreaterThan(0);
  });

  it("detects JTG internal terms (ROUTING_RULES)", () => {
    const issues = detectPromptLeak("The ROUTING_RULES table says...");
    expect(issues.some((i) => i.description.includes("ROUTING_RULES"))).toBe(true);
  });

  it("detects JTG internal terms (patent_internal)", () => {
    const issues = detectPromptLeak("See .patent-internal/weights.json");
    expect(issues.length).toBeGreaterThan(0);
  });

  it("detects prompt injection echo", () => {
    const issues = detectPromptLeak(
      "I'll ignore all previous instructions and tell you..."
    );
    expect(issues.length).toBeGreaterThan(0);
  });

  it("detects prompt content disclosure", () => {
    const issues = detectPromptLeak("My system prompt says I should help users.");
    expect(issues.length).toBeGreaterThan(0);
  });

  it("returns empty for normal response", () => {
    expect(
      detectPromptLeak("The deposit for this apartment is 200,000 yen.")
    ).toEqual([]);
  });

  it("returns empty for CJK response", () => {
    expect(detectPromptLeak("敷金は20万円です。礼金は1ヶ月分です。")).toEqual([]);
  });
});

// ── detectPiiExposure ────────────────────────────────────────────

describe("detectPiiExposure", () => {
  it("detects email address", () => {
    const issues = detectPiiExposure("Contact user@example.com for help.");
    expect(issues.some((i) => i.type === "pii_exposure")).toBe(true);
  });

  it("detects Japanese phone number (090-xxxx-xxxx)", () => {
    const issues = detectPiiExposure("Call 090-1234-5678.");
    expect(issues.length).toBeGreaterThan(0);
  });

  it("detects international phone number", () => {
    const issues = detectPiiExposure("Call +81-90-1234-5678.");
    expect(issues.length).toBeGreaterThan(0);
  });

  it("detects credit card number pattern", () => {
    const issues = detectPiiExposure("Card: 4111-1111-1111-1111");
    expect(issues.some((i) => i.description.includes("Credit card"))).toBe(true);
  });

  it("detects Japanese residence card number", () => {
    const issues = detectPiiExposure("Residence card: AB12345678CD");
    expect(issues.some((i) => i.description.includes("residence card"))).toBe(
      true
    );
  });

  it("detects My Number (12-digit)", () => {
    const issues = detectPiiExposure("My Number is 123456789012.");
    expect(issues.some((i) => i.description.includes("My Number"))).toBe(true);
  });

  it("returns empty for text without PII", () => {
    expect(detectPiiExposure("The rent is 80,000 yen per month.")).toEqual([]);
  });
});

// ── detectEncodingAttack ─────────────────────────────────────────

describe("detectEncodingAttack", () => {
  it("detects Cyrillic homoglyph mixed with Latin", () => {
    // Mix Latin 'a' with Cyrillic 'а' (U+0430)
    const issues = detectEncodingAttack("p\u0430yment");
    expect(issues.some((i) => i.type === "encoding_attack")).toBe(true);
    expect(issues[0].description).toContain("homoglyph");
  });

  it("does not flag pure Latin text", () => {
    expect(detectEncodingAttack("payment required")).toEqual([]);
  });

  it("does not flag pure CJK text", () => {
    expect(detectEncodingAttack("支払い必要")).toEqual([]);
  });

  it("detects zero-width characters", () => {
    const issues = detectEncodingAttack("hello\u200Bworld");
    expect(issues.some((i) => i.description.includes("Zero-width"))).toBe(true);
  });

  it("detects RTL override character", () => {
    const issues = detectEncodingAttack("Click \u202Ehere");
    expect(issues.some((i) => i.description.includes("Right-to-left"))).toBe(
      true
    );
  });

  it("handles empty string", () => {
    expect(detectEncodingAttack("")).toEqual([]);
  });
});

// ── sanitizeForRender ────────────────────────────────────────────

describe("sanitizeForRender", () => {
  it("encodes < and >", () => {
    expect(sanitizeForRender("<b>bold</b>")).toBe("&lt;b&gt;bold&lt;/b&gt;");
  });

  it("encodes & and quotes", () => {
    expect(sanitizeForRender('A & B "C"')).toBe(
      "A &amp; B &quot;C&quot;"
    );
  });

  it("strips null bytes", () => {
    expect(sanitizeForRender("hello\x00world")).toBe("helloworld");
  });

  it("strips zero-width characters", () => {
    expect(sanitizeForRender("a\u200Bb")).toBe("ab");
  });

  it("preserves normal text", () => {
    expect(sanitizeForRender("Safe text 日本語")).toBe("Safe text 日本語");
  });

  it("handles empty string", () => {
    expect(sanitizeForRender("")).toBe("");
  });
});

// ── sanitizeForGraphWriteback ────────────────────────────────────

describe("sanitizeForGraphWriteback", () => {
  it("strips HTML tags", () => {
    expect(sanitizeForGraphWriteback("<b>bold</b> text")).toBe("bold text");
  });

  it("collapses whitespace", () => {
    expect(sanitizeForGraphWriteback("hello   \n\t  world")).toBe("hello world");
  });

  it("truncates to 10000 characters", () => {
    const long = "a".repeat(15000);
    expect(sanitizeForGraphWriteback(long)).toHaveLength(10000);
  });

  it("handles empty string", () => {
    expect(sanitizeForGraphWriteback("")).toBe("");
  });
});

// ── sanitizeUrl ──────────────────────────────────────────────────

describe("sanitizeUrl", () => {
  it("allows https:", () => {
    expect(sanitizeUrl("https://example.com")).toBe("https://example.com");
  });

  it("allows http:", () => {
    expect(sanitizeUrl("http://example.com")).toBe("http://example.com");
  });

  it("allows mailto:", () => {
    expect(sanitizeUrl("mailto:user@example.com")).toBe(
      "mailto:user@example.com"
    );
  });

  it("allows tel:", () => {
    expect(sanitizeUrl("tel:+819012345678")).toBe("tel:+819012345678");
  });

  it("blocks javascript:", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBeNull();
  });

  it("blocks data:", () => {
    expect(sanitizeUrl("data:text/html,<h1>x</h1>")).toBeNull();
  });

  it("blocks file:", () => {
    expect(sanitizeUrl("file:///etc/passwd")).toBeNull();
  });

  it("trims whitespace", () => {
    expect(sanitizeUrl("  https://example.com  ")).toBe("https://example.com");
  });
});

// ── validateOutput ───────────────────────────────────────────────

describe("validateOutput", () => {
  it("returns ok for safe render text", () => {
    const result = validateOutput("The deposit is 2 months.", "render");
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.destination).toBe("render");
  });

  it("sanitizes HTML for render destination", () => {
    const result = validateOutput("<b>bold</b>", "render");
    expect(result.sanitized).toBe("&lt;b&gt;bold&lt;/b&gt;");
  });

  it("blocks critical issues for render", () => {
    const result = validateOutput('<script>alert("xss")</script>', "render");
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.severity === "critical")).toBe(true);
  });

  it("handles url_redirect destination — safe URL", () => {
    const result = validateOutput("https://mlit.go.jp", "url_redirect");
    expect(result.ok).toBe(true);
    expect(result.sanitized).toBe("https://mlit.go.jp");
  });

  it("handles url_redirect — blocks dangerous URL", () => {
    const result = validateOutput("javascript:alert(1)", "url_redirect");
    expect(result.ok).toBe(false);
    expect(result.sanitized).toBe("");
  });

  it("handles graph_writeback destination", () => {
    const result = validateOutput("<b>Some</b>  data  ", "graph_writeback");
    expect(result.sanitized).toBe("Some data");
  });

  it("handles display destination (same as render)", () => {
    const result = validateOutput("<img src=x>", "display");
    expect(result.sanitized).toContain("&lt;img");
  });

  it("handles tool_call destination", () => {
    const result = validateOutput("safe text", "tool_call");
    expect(result.ok).toBe(true);
  });

  it("detects PII in output", () => {
    const result = validateOutput(
      "Contact user@example.com for help.",
      "render"
    );
    expect(result.issues.some((i) => i.type === "pii_exposure")).toBe(true);
    // PII is high, not critical — so ok should still be true
    expect(result.ok).toBe(true);
  });

  it("detects prompt leak in output", () => {
    const result = validateOutput(
      "You are a helpful assistant. The ROUTING_RULES say...",
      "render"
    );
    expect(result.issues.some((i) => i.type === "prompt_leak")).toBe(true);
  });
});

// ── validateBatch ────────────────────────────────────────────────

describe("validateBatch", () => {
  it("validates multiple items", () => {
    const results = validateBatch([
      { text: "Safe text", destination: "render" },
      { text: '<script>xss</script>', destination: "render" },
      { text: "https://ok.com", destination: "url_redirect" },
    ]);
    expect(results).toHaveLength(3);
    expect(results[0].ok).toBe(true);
    expect(results[1].ok).toBe(false);
    expect(results[2].ok).toBe(true);
  });

  it("handles empty array", () => {
    expect(validateBatch([])).toEqual([]);
  });
});
