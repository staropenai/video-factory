/**
 * app/api/auth/status/__tests__/route.test.ts
 *
 * Tests for GET /api/auth/status.
 */

import { NextRequest } from "next/server";
import { __clearStoreForTests } from "@/lib/security/rate-limit";

// Mock next/headers cookies
jest.mock("next/headers", () => ({
  cookies: jest.fn(() =>
    Promise.resolve({
      get: () => undefined,
    })
  ),
}));

// Mock resolveIdentity to return a controlled anonymous identity
jest.mock("@/lib/auth/identity", () => ({
  resolveIdentity: jest.fn(() =>
    Promise.resolve({
      uid: "test-uid",
      isAuthenticated: false,
      isNewUid: false,
    })
  ),
}));

import { GET } from "../route";

function makeRequest(query = "") {
  return new NextRequest(`http://localhost/api/auth/status${query}`);
}

describe("GET /api/auth/status", () => {
  beforeEach(() => {
    __clearStoreForTests();
  });

  it("returns 200 with correct shape", async () => {
    const res = await GET(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toHaveProperty("identityType");
    expect(json.data).toHaveProperty("remaining");
    expect(json.data).toHaveProperty("canSubmit");
    expect(json.data).toHaveProperty("resetAtText");
    expect(json.data).toHaveProperty("used");
    expect(json.data).toHaveProperty("limit");
    expect(json.data).toHaveProperty("showUpgradeHint");
  });

  it("returns canSubmit as a boolean", async () => {
    const res = await GET(makeRequest());
    const json = await res.json();

    expect(typeof json.data.canSubmit).toBe("boolean");
  });

  it("returns identityType 'anonymous' for non-authenticated users", async () => {
    const res = await GET(makeRequest());
    const json = await res.json();

    expect(json.data.identityType).toBe("anonymous");
  });
});
