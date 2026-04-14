/**
 * lib/utils/__tests__/api-response.test.ts
 *
 * Unit tests for standardized API response helpers.
 */

import { ok, fail, unauthorized, notFound, rateLimited } from "../api-response";

describe("lib/utils/api-response", () => {
  describe("ok", () => {
    it("returns 200 with success true and data", async () => {
      const res = ok({ items: [1, 2, 3] });
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual({ items: [1, 2, 3] });
    });

    it("accepts custom status code", async () => {
      const res = ok("created", 201);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBe("created");
    });

    it("handles null data", async () => {
      const res = ok(null);
      const data = await res.json();
      expect(data.data).toBeNull();
    });
  });

  describe("fail", () => {
    it("returns 400 with error message", async () => {
      const res = fail("Invalid input");
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Invalid input");
    });

    it("accepts custom status", async () => {
      const res = fail("Conflict", 409);
      expect(res.status).toBe(409);
    });

    it("includes error code when provided", async () => {
      const res = fail("Quota exceeded", 429, "QUOTA_EXCEEDED");
      const data = await res.json();
      expect(data.code).toBe("QUOTA_EXCEEDED");
    });

    it("omits code field when not provided", async () => {
      const res = fail("Bad request");
      const data = await res.json();
      expect(data.code).toBeUndefined();
    });
  });

  describe("unauthorized", () => {
    it("returns 401", async () => {
      const res = unauthorized();
      const data = await res.json();
      expect(res.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("notFound", () => {
    it("returns 404 with default resource name", async () => {
      const res = notFound();
      const data = await res.json();
      expect(res.status).toBe(404);
      expect(data.error).toBe("Resource not found");
    });

    it("returns 404 with custom resource name", async () => {
      const res = notFound("FAQ entry");
      const data = await res.json();
      expect(data.error).toBe("FAQ entry not found");
    });
  });

  describe("rateLimited", () => {
    it("returns 429 with retryAfter", async () => {
      const res = rateLimited(30);
      const data = await res.json();
      expect(res.status).toBe(429);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Too many requests");
      expect(data.retryAfter).toBe(30);
    });

    it("includes Retry-After header", () => {
      const res = rateLimited(60);
      expect(res.headers.get("Retry-After")).toBe("60");
    });
  });
});
