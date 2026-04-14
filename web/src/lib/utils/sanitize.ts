/**
 * lib/utils/sanitize.ts — Input sanitization utilities.
 *
 * Lightweight helpers for cleaning user input before processing.
 * These complement (but do not replace) the prompt injection checks
 * in lib/security/prompt-injection.ts.
 */

/** Trim and truncate user input to a safe length. */
export function sanitizeInput(text: string, maxLength = 2000): string {
  return text
    .trim()
    .slice(0, maxLength)
    .replace(/<script[^>]*>.*?<\/script>/gi, "")
    .replace(/javascript:/gi, "");
}

/** Basic email format check (not exhaustive — for UI hints only). */
export const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

/** Truncate text with ellipsis. */
export const truncate = (text: string, max: number): string =>
  text.length <= max ? text : text.slice(0, max - 1) + "\u2026";

/** Strip control characters that could cause log injection. */
export function stripControlChars(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}
