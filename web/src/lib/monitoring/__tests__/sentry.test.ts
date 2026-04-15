/**
 * Tests for Sentry integration module.
 * Verifies no-op behavior when SENTRY_DSN is not set.
 */

// Mock @sentry/nextjs before importing
jest.mock("@sentry/nextjs", () => ({
  withScope: jest.fn((cb) => cb({ setTag: jest.fn(), setExtra: jest.fn() })),
  captureException: jest.fn(),
  startInactiveSpan: jest.fn(() => ({ end: jest.fn(), setAttribute: jest.fn() })),
  metrics: { distribution: jest.fn() },
}));

import {
  captureError,
  startSpan,
  recordMetric,
  isSentryActive,
} from "../sentry";

describe("Sentry integration", () => {
  const ORIGINAL_DSN = process.env.SENTRY_DSN;

  afterEach(() => {
    if (ORIGINAL_DSN !== undefined) {
      process.env.SENTRY_DSN = ORIGINAL_DSN;
    } else {
      delete process.env.SENTRY_DSN;
    }
  });

  it("isSentryActive returns false without DSN", () => {
    delete process.env.SENTRY_DSN;
    expect(isSentryActive()).toBe(false);
  });

  it("isSentryActive returns true with DSN", () => {
    process.env.SENTRY_DSN = "https://key@o0.ingest.sentry.io/0";
    expect(isSentryActive()).toBe(true);
  });

  it("captureError is a safe no-op without DSN", () => {
    delete process.env.SENTRY_DSN;
    expect(() => captureError(new Error("test"))).not.toThrow();
  });

  it("captureError with context is a safe no-op", () => {
    delete process.env.SENTRY_DSN;
    expect(() =>
      captureError(new Error("test"), {
        tags: { route: "/api/router" },
        extra: { latencyMs: 500 },
      })
    ).not.toThrow();
  });

  it("captureError with string error is a safe no-op", () => {
    delete process.env.SENTRY_DSN;
    expect(() => captureError("string error")).not.toThrow();
  });

  it("startSpan returns no-op wrapper without DSN", () => {
    delete process.env.SENTRY_DSN;
    const span = startSpan("test", "test");
    expect(span).toHaveProperty("end");
    expect(span).toHaveProperty("setTag");
    expect(() => span.end()).not.toThrow();
    expect(() => span.setTag("key", "value")).not.toThrow();
  });

  it("recordMetric is a safe no-op without DSN", () => {
    delete process.env.SENTRY_DSN;
    expect(() => recordMetric("test.metric", 42, "millisecond")).not.toThrow();
  });

  it("recordMetric with tags is a safe no-op", () => {
    delete process.env.SENTRY_DSN;
    expect(() =>
      recordMetric("test.metric", 42, "millisecond", { tier: "A" })
    ).not.toThrow();
  });

  it("captureError calls Sentry when DSN is set", () => {
    process.env.SENTRY_DSN = "https://key@o0.ingest.sentry.io/0";
    const Sentry = jest.requireMock("@sentry/nextjs");
    Sentry.withScope.mockClear();
    captureError(new Error("real error"), { tags: { event: "test" } });
    expect(Sentry.withScope).toHaveBeenCalled();
  });

  it("startSpan calls Sentry when DSN is set", () => {
    process.env.SENTRY_DSN = "https://key@o0.ingest.sentry.io/0";
    const Sentry = jest.requireMock("@sentry/nextjs");
    Sentry.startInactiveSpan.mockClear();
    const span = startSpan("test-span", "test-op");
    expect(Sentry.startInactiveSpan).toHaveBeenCalledWith({
      name: "test-span",
      op: "test-op",
    });
    expect(() => span.end()).not.toThrow();
  });

  it("recordMetric calls Sentry when DSN is set", () => {
    process.env.SENTRY_DSN = "https://key@o0.ingest.sentry.io/0";
    const Sentry = jest.requireMock("@sentry/nextjs");
    Sentry.metrics.distribution.mockClear();
    recordMetric("jtg.latency", 100, "millisecond", { tier: "C" });
    expect(Sentry.metrics.distribution).toHaveBeenCalledWith(
      "jtg.latency",
      100,
      { unit: "millisecond", attributes: { tier: "C" } }
    );
  });
});
