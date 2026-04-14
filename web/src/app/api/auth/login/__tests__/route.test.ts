/**
 * app/api/auth/login/__tests__/route.test.ts
 *
 * Integration-style tests for POST /api/auth/login.
 */

import { POST } from "../route";
import { NextRequest } from "next/server";
import { __clearStoreForTests } from "@/lib/security/rate-limit";

// Mock cookies() — Next.js server API not available in Jest
jest.mock("next/headers", () => ({
  cookies: jest.fn(() =>
    Promise.resolve({
      get: () => undefined,
    })
  ),
}));

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    __clearStoreForTests();
  });
  it("accepts a valid email", async () => {
    const res = await POST(makeRequest({ email: "test@example.com" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.quota).toBe(50);
    expect(typeof data.data.uid).toBe("string");
  });

  it("accepts a valid Japanese phone number", async () => {
    const res = await POST(makeRequest({ phone: "090-1234-5678" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("accepts E.164 international phone", async () => {
    const res = await POST(makeRequest({ phone: "+819012345678" }));
    expect(res.status).toBe(200);
  });

  it("rejects empty body", async () => {
    const res = await POST(makeRequest({}));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe("email_or_phone_required");
  });

  it("rejects malformed email", async () => {
    const res = await POST(makeRequest({ email: "not-an-email" }));
    expect(res.status).toBe(400);
  });

  it("rejects malformed phone", async () => {
    const res = await POST(makeRequest({ phone: "abc" }));
    expect(res.status).toBe(400);
  });

  it("rejects invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json{{{",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
