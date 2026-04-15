/**
 * lib/auth/__tests__/session-token.test.ts
 *
 * Unit tests for the standalone HMAC session token module.
 */

import {
  issueSessionToken,
  verifySessionToken,
  SESSION_TTL_MS,
} from "../session-token";

describe("auth/session-token", () => {
  const uid = "test-user-abc123";

  describe("issueSessionToken", () => {
    it("returns a non-empty string", () => {
      const token = issueSessionToken(uid);
      expect(typeof token).toBe("string");
      expect(token.length).toBeGreaterThan(0);
    });

    it("returns different tokens for same uid (nonce)", () => {
      const t1 = issueSessionToken(uid);
      const t2 = issueSessionToken(uid);
      expect(t1).not.toBe(t2);
    });

    it("returns different tokens for different uids", () => {
      const t1 = issueSessionToken("user-a");
      const t2 = issueSessionToken("user-b");
      expect(t1).not.toBe(t2);
    });

    it("token is valid base64url-encoded JSON", () => {
      const token = issueSessionToken(uid);
      const decoded = Buffer.from(token, "base64url").toString();
      const parsed = JSON.parse(decoded);
      expect(parsed).toHaveProperty("payload");
      expect(parsed).toHaveProperty("sig");
    });

    it("payload contains uid, timestamp, and nonce", () => {
      const token = issueSessionToken(uid);
      const decoded = Buffer.from(token, "base64url").toString();
      const { payload } = JSON.parse(decoded);
      const parts = payload.split(":");
      expect(parts.length).toBe(3);
      expect(parts[0]).toBe(uid);
      expect(Number(parts[1])).not.toBeNaN();
      expect(parts[2].length).toBeGreaterThan(0); // nonce
    });
  });

  describe("verifySessionToken", () => {
    it("accepts a fresh, valid token", () => {
      const token = issueSessionToken(uid);
      const result = verifySessionToken(token, uid);
      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("rejects when uid does not match", () => {
      const token = issueSessionToken("user-a");
      const result = verifySessionToken(token, "user-b");
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("uid_mismatch");
    });

    it("rejects a completely invalid token", () => {
      const result = verifySessionToken("garbage!@#$", uid);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("malformed");
    });

    it("rejects an empty token", () => {
      const result = verifySessionToken("", uid);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("malformed");
    });

    it("rejects a tampered signature", () => {
      const token = issueSessionToken(uid);
      const decoded = JSON.parse(Buffer.from(token, "base64url").toString());
      decoded.sig = "tampered" + decoded.sig;
      const tampered = Buffer.from(JSON.stringify(decoded)).toString(
        "base64url"
      );
      const result = verifySessionToken(tampered, uid);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("bad_sig");
    });

    it("rejects a tampered payload", () => {
      const token = issueSessionToken(uid);
      const decoded = JSON.parse(Buffer.from(token, "base64url").toString());
      decoded.payload = "evil-uid:12345:abc";
      const tampered = Buffer.from(JSON.stringify(decoded)).toString(
        "base64url"
      );
      const result = verifySessionToken(tampered, uid);
      expect(result.valid).toBe(false);
      // Could be uid_mismatch or bad_sig depending on order
      expect(result.valid).toBe(false);
    });

    it("rejects an expired token (TTL boundary: >= means exact TTL is expired)", () => {
      // Mock Date.now to simulate time passing
      const realNow = Date.now;
      const issueTime = realNow.call(Date);

      // Issue token at current time
      const token = issueSessionToken(uid);

      // Fast-forward past TTL
      Date.now = () => issueTime + SESSION_TTL_MS;
      const result = verifySessionToken(token, uid);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("expired");

      Date.now = realNow;
    });

    it("accepts token just before TTL boundary", () => {
      const realNow = Date.now;
      const issueTime = realNow.call(Date);

      const token = issueSessionToken(uid);

      // 1ms before TTL
      Date.now = () => issueTime + SESSION_TTL_MS - 1;
      const result = verifySessionToken(token, uid);
      expect(result.valid).toBe(true);

      Date.now = realNow;
    });

    it("rejects token well past TTL", () => {
      const realNow = Date.now;
      const issueTime = realNow.call(Date);

      const token = issueSessionToken(uid);

      // 10 minutes past TTL
      Date.now = () => issueTime + SESSION_TTL_MS + 10 * 60 * 1000;
      const result = verifySessionToken(token, uid);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("expired");

      Date.now = realNow;
    });
  });

  describe("nonce uniqueness", () => {
    it("100 tokens for same uid are all unique", () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tokens.add(issueSessionToken(uid));
      }
      expect(tokens.size).toBe(100);
    });
  });
});
