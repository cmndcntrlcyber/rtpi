import { describe, it, expect } from "vitest";
import {
  MemoryAdapter,
  MemoryHit,
  MemoryRouter,
} from "../../../server/services/memory/memory-router";

function createMockAdapter(
  name: string,
  available: boolean,
  results: MemoryHit[],
): MemoryAdapter {
  return {
    name,
    isAvailable: async () => available,
    query: async () => results,
  };
}

describe("MemoryRouter", () => {
  it("returns empty when no adapters registered", async () => {
    const router = new MemoryRouter();
    const hits = await router.query("test", {});
    expect(hits).toEqual([]);
  });

  it("queries single adapter", async () => {
    const router = new MemoryRouter();
    const results: MemoryHit[] = [
      { id: "h1", text: "hit one", score: 0.9, source: "native" },
      { id: "h2", text: "hit two", score: 0.8, source: "native" },
    ];
    router.registerAdapter(createMockAdapter("native", true, results));
    const hits = await router.query("test", {});
    expect(hits).toHaveLength(2);
  });

  it("skips unavailable adapters", async () => {
    const router = new MemoryRouter();
    router.registerAdapter(
      createMockAdapter("native", true, [
        { id: "h1", text: "native hit", score: 0.9, source: "native" },
      ]),
    );
    router.registerAdapter(
      createMockAdapter("mem0", false, [
        { id: "h2", text: "mem0 hit", score: 0.8, source: "mem0" },
      ]),
    );
    const hits = await router.query("test", {});
    expect(hits).toHaveLength(1);
    expect(hits[0].id).toBe("h1");
  });

  it("merges results from multiple adapters via RRF", async () => {
    const router = new MemoryRouter();
    router.registerAdapter(
      createMockAdapter("native", true, [
        { id: "a1", text: "native first", score: 0.9, source: "native" },
        { id: "a2", text: "native second", score: 0.8, source: "native" },
      ]),
    );
    router.registerAdapter(
      createMockAdapter("mem0", true, [
        { id: "b1", text: "mem0 first", score: 0.95, source: "mem0" },
        { id: "b2", text: "mem0 second", score: 0.7, source: "mem0" },
      ]),
    );
    const hits = await router.query("test", {}, "all", 3);
    expect(hits.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i - 1].score).toBeGreaterThanOrEqual(hits[i].score);
    }
  });

  it("deduplicates by id", async () => {
    const router = new MemoryRouter();
    router.registerAdapter(
      createMockAdapter("native", true, [
        { id: "shared", text: "shared hit", score: 0.9, source: "native" },
      ]),
    );
    router.registerAdapter(
      createMockAdapter("mem0", true, [
        { id: "shared", text: "shared hit", score: 0.8, source: "mem0" },
      ]),
    );
    const hits = await router.query("test", {});
    const sharedHits = hits.filter((h) => h.id === "shared");
    expect(sharedHits).toHaveLength(1);
  });

  it("respects tier=fast", async () => {
    const router = new MemoryRouter();
    router.registerAdapter(
      createMockAdapter("native", true, [
        { id: "n1", text: "native", score: 0.9, source: "native" },
      ]),
    );
    router.registerAdapter(
      createMockAdapter("mem0", true, [
        { id: "m1", text: "mem0", score: 0.9, source: "mem0" },
      ]),
    );
    router.registerAdapter(
      createMockAdapter("kb", true, [
        { id: "k1", text: "kb", score: 0.9, source: "kb" },
      ]),
    );
    const hits = await router.query("test", {}, "fast");
    const sources = hits.map((h) => h.source);
    expect(sources).toContain("native");
    expect(sources).not.toContain("mem0");
    expect(sources).not.toContain("kb");
  });

  it("respects tier=deep", async () => {
    const router = new MemoryRouter();
    router.registerAdapter(
      createMockAdapter("native", true, [
        { id: "n1", text: "native", score: 0.9, source: "native" },
      ]),
    );
    router.registerAdapter(
      createMockAdapter("mem0", true, [
        { id: "m1", text: "mem0", score: 0.9, source: "mem0" },
      ]),
    );
    router.registerAdapter(
      createMockAdapter("kb", true, [
        { id: "k1", text: "kb", score: 0.9, source: "kb" },
      ]),
    );
    const hits = await router.query("test", {}, "deep");
    const sources = hits.map((h) => h.source);
    expect(sources).toContain("native");
    expect(sources).toContain("mem0");
    expect(sources).not.toContain("kb");
  });

  it("respects limit", async () => {
    const router = new MemoryRouter();
    const results: MemoryHit[] = Array.from({ length: 10 }, (_, i) => ({
      id: `h${i}`,
      text: `hit ${i}`,
      score: 1 - i * 0.1,
      source: "native" as const,
    }));
    router.registerAdapter(createMockAdapter("native", true, results));
    const hits = await router.query("test", {}, "all", 3);
    expect(hits).toHaveLength(3);
  });

  it("handles adapter query failure gracefully", async () => {
    const router = new MemoryRouter();
    const failingAdapter: MemoryAdapter = {
      name: "native",
      isAvailable: async () => true,
      query: async () => {
        throw new Error("connection lost");
      },
    };
    router.registerAdapter(failingAdapter);
    router.registerAdapter(
      createMockAdapter("mem0", true, [
        { id: "m1", text: "mem0 hit", score: 0.9, source: "mem0" },
      ]),
    );
    const hits = await router.query("test", {});
    expect(hits).toHaveLength(1);
    expect(hits[0].id).toBe("m1");
  });
});
