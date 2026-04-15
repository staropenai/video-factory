/**
 * lib/hooks/__tests__/useQuota.test.ts
 *
 * Unit tests for the useQuota React hook.
 *
 * Strategy: mock React primitives and global `fetch` so we can exercise
 * the hook's fetch/state logic in a Node test environment without JSDOM.
 */

// ── Track state updates ────────────────────────────────────────────
let stateStore: Record<string, unknown> = {};
const setStateCalls: unknown[] = [];
let capturedEffect: (() => (() => void) | void) | null = null;

/**
 * Override the initial state returned by useState on next hook call.
 * This lets us simulate a re-render where the hook reads updated quota.
 */
let stateOverride: Record<string, unknown> | null = null;

jest.mock("react", () => ({
  useState: (init: unknown) => {
    if (stateOverride) {
      stateStore = stateOverride;
      stateOverride = null;
    } else {
      stateStore = typeof init === "object" && init !== null ? { ...init as object } : { _v: init };
    }
    const setter = (valOrFn: unknown) => {
      if (typeof valOrFn === "function") {
        const result = (valOrFn as (s: unknown) => unknown)(stateStore);
        stateStore = result as Record<string, unknown>;
      } else {
        stateStore = valOrFn as Record<string, unknown>;
      }
      setStateCalls.push(stateStore);
    };
    return [stateStore, setter];
  },
  useEffect: (fn: () => (() => void) | void) => {
    capturedEffect = fn;
  },
  useCallback: (fn: unknown) => fn,
}));

// ── Fetch mock ─────────────────────────────────────────────────────
const mockFetch = jest.fn();
(global as Record<string, unknown>).fetch = mockFetch;

// ── Import after mocks ─────────────────────────────────────────────
import { useQuota } from "../useQuota";
import type { QuotaState, OpenSessionResult, OpenSessionError } from "../useQuota";

// ── Helpers ────────────────────────────────────────────────────────
function makeJsonResponse(body: Record<string, unknown>, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}

function resetMocks() {
  stateStore = {};
  setStateCalls.length = 0;
  capturedEffect = null;
  stateOverride = null;
  mockFetch.mockReset();
}

// ── Tests ──────────────────────────────────────────────────────────

describe("lib/hooks/useQuota", () => {
  beforeEach(resetMocks);

  // ── Mount fetch (useEffect) ─────────────────────────────────────

  describe("fetchStatus on mount", () => {
    it("fetches /api/usage/today with lang param", async () => {
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse({
          used: 5,
          limit: 30,
          remaining: 25,
          blocked: false,
          showUpgradeHint: false,
          resetAtText: "约 6 小时后重置",
        })
      );

      useQuota("zh");
      expect(capturedEffect).not.toBeNull();

      // Run the effect
      const cleanup = capturedEffect!();
      await new Promise((r) => setTimeout(r, 10));

      expect(mockFetch).toHaveBeenCalledWith("/api/usage/today?lang=zh");

      // State should be updated
      const last = setStateCalls[setStateCalls.length - 1] as QuotaState;
      expect(last.ready).toBe(true);
      expect(last.used).toBe(5);
      expect(last.remaining).toBe(25);
      expect(last.blocked).toBe(false);

      // Cleanup
      if (typeof cleanup === "function") cleanup();
    });

    it("uses nested ai.* fields as fallback", async () => {
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse({
          ai: { used: 10, limit: 30, remaining: 20, resetAtText: "reset soon" },
        })
      );

      useQuota("en");
      const cleanup = capturedEffect!();
      await new Promise((r) => setTimeout(r, 10));

      const last = setStateCalls[setStateCalls.length - 1] as QuotaState;
      expect(last.used).toBe(10);
      expect(last.remaining).toBe(20);
      expect(last.resetAtText).toBe("reset soon");

      if (typeof cleanup === "function") cleanup();
    });

    it("handles non-ok response gracefully", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      useQuota("ja");
      const cleanup = capturedEffect!();
      await new Promise((r) => setTimeout(r, 10));

      // No state update on non-ok (early return)
      expect(setStateCalls).toHaveLength(0);

      if (typeof cleanup === "function") cleanup();
    });

    it("handles network error — sets ready true without blocking", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      useQuota("ko");
      const cleanup = capturedEffect!();
      await new Promise((r) => setTimeout(r, 10));

      // The catch path sets ready: true via updater function
      const last = setStateCalls[setStateCalls.length - 1] as QuotaState;
      expect(last.ready).toBe(true);

      if (typeof cleanup === "function") cleanup();
    });

    it("does not update state after cleanup (cancelled)", async () => {
      let resolveResponse: (v: unknown) => void;
      mockFetch.mockReturnValueOnce(
        new Promise((r) => { resolveResponse = r; })
      );

      useQuota("vi");
      const cleanup = capturedEffect!();

      // Cleanup before fetch resolves
      if (typeof cleanup === "function") cleanup();

      // Now resolve
      resolveResponse!(makeJsonResponse({ used: 5, limit: 30, remaining: 25 }));
      await new Promise((r) => setTimeout(r, 10));

      // No state updates because cancelled=true
      expect(setStateCalls).toHaveLength(0);
    });
  });

  // ── openSession ─────────────────────────────────────────────────

  describe("openSession", () => {
    it("returns quota_exceeded when remaining <= 0 (client guard)", async () => {
      // Simulate a re-render where quota state already shows remaining=0
      stateOverride = {
        ready: true,
        used: 30,
        limit: 30,
        remaining: 0,
        blocked: true,
        showUpgradeHint: true,
        resetAtText: "已达上限",
      };

      const { openSession } = useQuota("zh");

      // openSession should short-circuit without making a fetch call
      mockFetch.mockClear();
      const result = (await (openSession as () => Promise<OpenSessionResult | OpenSessionError>)()) as OpenSessionError;

      expect(result.ok).toBe(false);
      expect(result.error).toBe("quota_exceeded");
      expect(result.resetAtText).toBe("已达上限");
      // Should NOT have made another fetch call
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns session token on success", async () => {
      // Initial fetch — has remaining
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse({ used: 2, limit: 30, remaining: 28 })
      );

      const { openSession } = useQuota("en");
      capturedEffect!();
      await new Promise((r) => setTimeout(r, 10));

      // openSession call
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse({
          ok: true,
          sessionToken: "tok_abc123",
          used: 3,
          limit: 30,
          remaining: 27,
          blocked: false,
          showUpgradeHint: false,
          resetAtText: "resets in 5h",
        })
      );

      const result = (await (openSession as () => Promise<OpenSessionResult | OpenSessionError>)()) as OpenSessionResult;

      expect(result.ok).toBe(true);
      expect(result.sessionToken).toBe("tok_abc123");
      expect(result.quota.remaining).toBe(27);
      expect(result.quota.used).toBe(3);
    });

    it("handles 429 — updates state to blocked", async () => {
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse({ used: 29, limit: 30, remaining: 1 })
      );

      const { openSession } = useQuota("zh");
      capturedEffect!();
      await new Promise((r) => setTimeout(r, 10));

      // openSession returns 429
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse({ resetAtText: "1 小时后重置" }, 429)
      );

      const result = (await (openSession as () => Promise<OpenSessionResult | OpenSessionError>)()) as OpenSessionError;

      expect(result.ok).toBe(false);
      expect(result.error).toBe("quota_exceeded");
      expect(result.resetAtText).toBe("1 小时后重置");

      // State updated to blocked
      const last = setStateCalls[setStateCalls.length - 1] as QuotaState;
      expect(last.blocked).toBe(true);
      expect(last.remaining).toBe(0);
      expect(last.showUpgradeHint).toBe(true);
    });

    it("handles non-ok non-429 response", async () => {
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse({ used: 5, limit: 30, remaining: 25 })
      );

      const { openSession } = useQuota("zh");
      capturedEffect!();
      await new Promise((r) => setTimeout(r, 10));

      // 500 error
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse({ ok: false, error: "internal" }, 500)
      );

      const result = (await (openSession as () => Promise<OpenSessionResult | OpenSessionError>)()) as OpenSessionError;

      expect(result.ok).toBe(false);
      expect(result.error).toBe("unknown");
    });

    it("handles response where data.ok is false", async () => {
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse({ used: 5, limit: 30, remaining: 25 })
      );

      const { openSession } = useQuota("zh");
      capturedEffect!();
      await new Promise((r) => setTimeout(r, 10));

      // Status 200 but body.ok = false
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse({ ok: false, error: "invalid_session" })
      );

      const result = (await (openSession as () => Promise<OpenSessionResult | OpenSessionError>)()) as OpenSessionError;

      expect(result.ok).toBe(false);
      expect(result.error).toBe("unknown");
    });

    it("handles network error during openSession", async () => {
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse({ used: 5, limit: 30, remaining: 25 })
      );

      const { openSession } = useQuota("ja");
      capturedEffect!();
      await new Promise((r) => setTimeout(r, 10));

      mockFetch.mockRejectedValueOnce(new Error("Offline"));

      const result = (await (openSession as () => Promise<OpenSessionResult | OpenSessionError>)()) as OpenSessionError;

      expect(result.ok).toBe(false);
      expect(result.error).toBe("network_error");
    });

    it("sends POST to /api/ai/session/open with lang in body", async () => {
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse({ used: 0, limit: 30, remaining: 30 })
      );

      const { openSession } = useQuota("th");
      capturedEffect!();
      await new Promise((r) => setTimeout(r, 10));

      mockFetch.mockResolvedValueOnce(
        makeJsonResponse({
          ok: true,
          sessionToken: "tok_xyz",
          used: 1,
          limit: 30,
          remaining: 29,
          blocked: false,
          showUpgradeHint: false,
          resetAtText: "",
        })
      );

      await (openSession as () => Promise<OpenSessionResult | OpenSessionError>)();

      expect(mockFetch).toHaveBeenLastCalledWith("/api/ai/session/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang: "th" }),
      });
    });
  });

  // ── Initial state ───────────────────────────────────────────────

  describe("initial state", () => {
    it("provides correct initial quota values", () => {
      const { quota } = useQuota();

      expect(quota.ready).toBe(false);
      expect(quota.used).toBe(0);
      expect(quota.limit).toBe(30);
      expect(quota.remaining).toBe(30);
      expect(quota.blocked).toBe(false);
      expect(quota.showUpgradeHint).toBe(false);
      expect(quota.resetAtText).toBe("");
    });

    it("defaults lang to 'zh'", () => {
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse({ used: 0, limit: 30, remaining: 30 })
      );

      useQuota();
      capturedEffect!();

      expect(mockFetch).toHaveBeenCalledWith("/api/usage/today?lang=zh");
    });
  });
});
