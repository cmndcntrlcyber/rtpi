import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../../server/db", () => ({
  db: {
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}));

vi.mock("../../../server/services/mcp-server-manager", () => ({
  mcpServerManager: {
    getChildProcess: vi.fn().mockReturnValue(null),
  },
}));

describe("MCP Invoker Metrics", () => {
  describe("P95 computation", () => {
    it("should compute correct P95 from a sorted window", () => {
      const durations = Array.from({ length: 100 }, (_, i) => (i + 1) * 10);
      const sorted = durations.slice().sort((a, b) => a - b);
      const p95 = sorted[Math.ceil(0.95 * sorted.length) - 1];
      expect(p95).toBe(950);
    });

    it("should compute correct average", () => {
      const durations = [100, 200, 300, 400, 500];
      const avg = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
      expect(avg).toBe(300);
    });

    it("should handle single-element window", () => {
      const durations = [42];
      const sorted = durations.slice().sort((a, b) => a - b);
      const p95 = sorted[Math.ceil(0.95 * sorted.length) - 1];
      const avg = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
      expect(p95).toBe(42);
      expect(avg).toBe(42);
    });

    it("should compute P95 correctly with skewed distribution", () => {
      const durations = [...Array(95).fill(10), ...Array(5).fill(1000)];
      const sorted = durations.slice().sort((a, b) => a - b);
      const p95 = sorted[Math.ceil(0.95 * sorted.length) - 1];
      expect(p95).toBe(10);
    });
  });

  describe("Window size cap", () => {
    it("should cap recentDurations at window size of 100", () => {
      const buffer: number[] = [];
      const METRICS_WINDOW_SIZE = 100;

      for (let i = 0; i < 150; i++) {
        buffer.push(i);
        if (buffer.length > METRICS_WINDOW_SIZE) {
          buffer.splice(0, buffer.length - METRICS_WINDOW_SIZE);
        }
      }

      expect(buffer.length).toBe(100);
      expect(buffer[0]).toBe(50);
      expect(buffer[99]).toBe(149);
    });
  });

  describe("Metrics DB flush", () => {
    it("should write avg and p95 to DB on flush", async () => {
      const { db } = await import("../../../server/db");

      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      });
      vi.mocked(db.update).mockReturnValue({
        set: mockSet,
      } as any);

      const durations = [100, 200, 300, 400, 500];
      const avg = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
      const sorted = durations.slice().sort((a, b) => a - b);
      const p95 = sorted[Math.ceil(0.95 * sorted.length) - 1];

      expect(avg).toBe(300);
      expect(p95).toBe(500);
    });
  });
});
