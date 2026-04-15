/**
 * Tests for TTFT tracking module.
 */

jest.mock("@/lib/monitoring/sentry", () => ({
  recordMetric: jest.fn(),
  startSpan: jest.fn(() => ({ end: jest.fn(), setTag: jest.fn() })),
}));

import {
  recordRouterLatency,
  recordTTFT,
  recordTierHit,
  spanRouterPhase,
} from "../ttft";
import { recordMetric, startSpan } from "@/lib/monitoring/sentry";

const mockRecordMetric = recordMetric as jest.MockedFunction<
  typeof recordMetric
>;
const mockStartSpan = startSpan as jest.MockedFunction<typeof startSpan>;

describe("TTFT tracking", () => {
  beforeEach(() => {
    mockRecordMetric.mockClear();
    mockStartSpan.mockClear();
  });

  it("recordRouterLatency sends latency metric with opts", () => {
    recordRouterLatency(150, "A", { fastPath: true, language: "zh" });
    expect(mockRecordMetric).toHaveBeenCalledWith(
      "jtg.router.latency",
      150,
      "millisecond",
      expect.objectContaining({
        tier: "A",
        fast_path: "true",
        language: "zh",
      })
    );
  });

  it("recordRouterLatency sends latency metric without opts", () => {
    recordRouterLatency(800, "C");
    expect(mockRecordMetric).toHaveBeenCalledWith(
      "jtg.router.latency",
      800,
      "millisecond",
      { tier: "C" }
    );
  });

  it("recordTTFT sends TTFT metric", () => {
    recordTTFT(350);
    expect(mockRecordMetric).toHaveBeenCalledWith(
      "jtg.router.ttft",
      350,
      "millisecond",
      { tier: "C" }
    );
  });

  it("recordTierHit sends tier distribution metric", () => {
    recordTierHit("B");
    expect(mockRecordMetric).toHaveBeenCalledWith(
      "jtg.router.tier_hit",
      1,
      "none",
      { tier: "B" }
    );
  });

  it("spanRouterPhase creates a span", () => {
    spanRouterPhase("understanding");
    expect(mockStartSpan).toHaveBeenCalledWith(
      "router.understanding",
      "router"
    );
  });

  it("recordRouterLatency with L6 tier", () => {
    recordRouterLatency(300000, "L6");
    expect(mockRecordMetric).toHaveBeenCalledWith(
      "jtg.router.latency",
      300000,
      "millisecond",
      { tier: "L6" }
    );
  });
});
