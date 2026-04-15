/**
 * lib/utils/__tests__/sanitize.test.ts
 *
 * Unit tests for input sanitization utilities.
 */

import {
  sanitizeInput,
  isValidEmail,
  truncate,
  stripControlChars,
} from "../sanitize";

describe("lib/utils/sanitize", () => {
  describe("sanitizeInput", () => {
    it("trims whitespace", () => {
      expect(sanitizeInput("  hello  ")).toBe("hello");
    });

    it("truncates to default max length (2000)", () => {
      const long = "a".repeat(3000);
      expect(sanitizeInput(long)).toHaveLength(2000);
    });

    it("truncates to custom max length", () => {
      expect(sanitizeInput("abcdef", 3)).toBe("abc");
    });

    it("strips script tags", () => {
      expect(sanitizeInput('hello<script>alert("xss")</script>world')).toBe(
        "helloworld"
      );
    });

    it("strips script tags case-insensitively", () => {
      expect(sanitizeInput("<SCRIPT>bad</SCRIPT>ok")).toBe("ok");
    });

    it("strips javascript: protocol", () => {
      expect(sanitizeInput("javascript:alert(1)")).toBe("alert(1)");
    });

    it("handles empty string", () => {
      expect(sanitizeInput("")).toBe("");
    });

    it("handles whitespace-only input", () => {
      expect(sanitizeInput("   ")).toBe("");
    });

    it("preserves normal text", () => {
      expect(sanitizeInput("How much is the deposit?")).toBe(
        "How much is the deposit?"
      );
    });

    it("preserves CJK characters", () => {
      expect(sanitizeInput("敷金はいくらですか？")).toBe("敷金はいくらですか？");
    });
  });

  describe("isValidEmail", () => {
    it("accepts valid email", () => {
      expect(isValidEmail("test@example.com")).toBe(true);
    });

    it("accepts email with subdomain", () => {
      expect(isValidEmail("user@mail.example.co.jp")).toBe(true);
    });

    it("rejects empty string", () => {
      expect(isValidEmail("")).toBe(false);
    });

    it("rejects missing @", () => {
      expect(isValidEmail("testexample.com")).toBe(false);
    });

    it("rejects missing domain", () => {
      expect(isValidEmail("test@")).toBe(false);
    });

    it("rejects spaces", () => {
      expect(isValidEmail("test @example.com")).toBe(false);
    });
  });

  describe("truncate", () => {
    it("returns short text unchanged", () => {
      expect(truncate("hello", 10)).toBe("hello");
    });

    it("returns text at exact max unchanged", () => {
      expect(truncate("hello", 5)).toBe("hello");
    });

    it("truncates with ellipsis when over max", () => {
      const result = truncate("hello world", 6);
      expect(result).toHaveLength(6);
      expect(result.endsWith("\u2026")).toBe(true);
    });

    it("handles empty string", () => {
      expect(truncate("", 10)).toBe("");
    });
  });

  describe("stripControlChars", () => {
    it("removes null bytes", () => {
      expect(stripControlChars("hello\x00world")).toBe("helloworld");
    });

    it("removes bell character", () => {
      expect(stripControlChars("test\x07data")).toBe("testdata");
    });

    it("preserves newlines and tabs", () => {
      expect(stripControlChars("hello\n\tworld")).toBe("hello\n\tworld");
    });

    it("preserves normal text", () => {
      expect(stripControlChars("normal text 日本語")).toBe("normal text 日本語");
    });

    it("removes DEL character", () => {
      expect(stripControlChars("test\x7Fdata")).toBe("testdata");
    });

    it("handles empty string", () => {
      expect(stripControlChars("")).toBe("");
    });
  });
});
