/**
 * lib/auth/__tests__/admin-guard.test.ts
 *
 * Unit tests for admin endpoint authentication guard.
 */

import { NextRequest } from "next/server";

function makeReq(authHeader?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (authHeader) headers["authorization"] = authHeader;
  return new NextRequest("http://localhost/api/review", {
    method: "GET",
    headers,
  });
}

describe("auth/admin-guard", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  describe("when JTG_ADMIN_TOKEN is set", () => {
    const TOKEN = "test-admin-secret-token-xyz";

    function getGuard() {
      process.env.JTG_ADMIN_TOKEN = TOKEN;
      let mod: typeof import("../admin-guard");
      jest.isolateModules(() => {
        mod = require("../admin-guard");
      });
      return mod!.requireAdmin;
    }

    it("allows request with correct Bearer token", () => {
      const requireAdmin = getGuard();
      const result = requireAdmin(makeReq(`Bearer ${TOKEN}`));
      expect(result.ok).toBe(true);
    });

    it("rejects request with wrong token (403)", () => {
      const requireAdmin = getGuard();
      const result = requireAdmin(makeReq("Bearer wrong-token"));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.response.status).toBe(403);
    });

    it("rejects request with no Authorization header (401)", () => {
      const requireAdmin = getGuard();
      const result = requireAdmin(makeReq());
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.response.status).toBe(401);
    });

    it("rejects non-Bearer auth scheme (401)", () => {
      const requireAdmin = getGuard();
      const result = requireAdmin(makeReq("Basic dXNlcjpwYXNz"));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.response.status).toBe(401);
    });

    it("rejects empty Bearer value", () => {
      const requireAdmin = getGuard();
      const result = requireAdmin(makeReq("Bearer "));
      expect(result.ok).toBe(false);
      // Empty bearer may return 401 (header trimmed) or 403 (empty vs token)
      if (!result.ok) {
        expect([401, 403]).toContain(result.response.status);
      }
    });
  });

  describe("when JTG_ADMIN_TOKEN is NOT set", () => {
    function getGuard(nodeEnv: string) {
      delete process.env.JTG_ADMIN_TOKEN;
      (process.env as Record<string, string | undefined>).NODE_ENV = nodeEnv;
      let mod: typeof import("../admin-guard");
      jest.isolateModules(() => {
        mod = require("../admin-guard");
      });
      return mod!.requireAdmin;
    }

    it("allows in development without token", () => {
      const requireAdmin = getGuard("development");
      const result = requireAdmin(makeReq());
      expect(result.ok).toBe(true);
    });

    it("allows in test without token", () => {
      const requireAdmin = getGuard("test");
      const result = requireAdmin(makeReq());
      expect(result.ok).toBe(true);
    });

    it("returns 503 in production without token configured", () => {
      const requireAdmin = getGuard("production");
      const result = requireAdmin(makeReq());
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.response.status).toBe(503);
    });
  });
});
