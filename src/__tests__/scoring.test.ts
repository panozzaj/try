import { describe, it, expect, beforeEach } from "bun:test";
import {
  parseDatePrefix,
  todayPrefix,
  calculateTimeScore,
  scoreEntries,
  normalizeName,
  createDirName,
} from "../lib/scoring.js";
import type { TryEntry } from "../types.js";

describe("parseDatePrefix", () => {
  it("parses date-prefixed names", () => {
    const result = parseDatePrefix("2025-12-12-my-experiment");
    expect(result.datePrefix).toBe("2025-12-12");
    expect(result.baseName).toBe("my-experiment");
  });

  it("handles date-only names", () => {
    const result = parseDatePrefix("2025-12-12");
    expect(result.datePrefix).toBe("2025-12-12");
    expect(result.baseName).toBe("2025-12-12");
  });

  it("handles names without date prefix", () => {
    const result = parseDatePrefix("my-experiment");
    expect(result.datePrefix).toBeUndefined();
    expect(result.baseName).toBe("my-experiment");
  });

  it("handles invalid date formats", () => {
    const result = parseDatePrefix("25-12-12-experiment");
    expect(result.datePrefix).toBeUndefined();
    expect(result.baseName).toBe("25-12-12-experiment");
  });
});

describe("todayPrefix", () => {
  it("returns a valid date prefix", () => {
    const prefix = todayPrefix();
    expect(prefix).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("matches current date", () => {
    const prefix = todayPrefix();
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    expect(prefix).toBe(`${year}-${month}-${day}`);
  });
});

describe("calculateTimeScore", () => {
  it("returns 1 for just modified", () => {
    const score = calculateTimeScore(new Date());
    expect(score).toBeCloseTo(1, 1);
  });

  it("decays over time", () => {
    const now = Date.now();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const score = calculateTimeScore(oneDayAgo);
    expect(score).toBeLessThan(0.7);
    expect(score).toBeGreaterThan(0.1);
  });

  it("approaches zero for old entries", () => {
    const now = Date.now();
    const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const score = calculateTimeScore(oneWeekAgo);
    expect(score).toBeLessThan(0.1);
  });
});

describe("scoreEntries", () => {
  const createEntry = (
    name: string,
    modifiedAt: Date = new Date()
  ): TryEntry => ({
    path: `/home/user/tries/${name}`,
    name,
    createdAt: new Date(),
    accessedAt: new Date(),
    modifiedAt,
    ...parseDatePrefix(name),
  });

  it("returns all entries sorted by time when query is empty", () => {
    const now = Date.now();
    const entries = [
      createEntry("2025-12-12-old", new Date(now - 2 * 24 * 60 * 60 * 1000)),
      createEntry("2025-12-12-new", new Date(now)),
      createEntry("2025-12-12-mid", new Date(now - 1 * 24 * 60 * 60 * 1000)),
    ];

    const scored = scoreEntries(entries, "");

    expect(scored[0].name).toBe("2025-12-12-new");
    expect(scored[1].name).toBe("2025-12-12-mid");
    expect(scored[2].name).toBe("2025-12-12-old");
  });

  it("filters and scores by fuzzy match", () => {
    const entries = [
      createEntry("2025-12-12-api-refactor"),
      createEntry("2025-12-12-testing-ink"),
      createEntry("2025-12-12-api-tests"),
    ];

    const scored = scoreEntries(entries, "api");

    expect(scored.length).toBe(2);
    expect(scored.every((e) => e.name.includes("api"))).toBe(true);
  });

  it("provides matched indices for highlighting", () => {
    const entries = [createEntry("2025-12-12-test")];
    const scored = scoreEntries(entries, "test");

    expect(scored.length).toBe(1);
    expect(scored[0].matchedIndices.length).toBeGreaterThan(0);
  });

  it("returns empty array for no matches", () => {
    const entries = [createEntry("2025-12-12-foo")];
    const scored = scoreEntries(entries, "xyz123");

    expect(scored.length).toBe(0);
  });
});

describe("normalizeName", () => {
  it("converts to lowercase", () => {
    expect(normalizeName("MyProject")).toBe("myproject");
  });

  it("replaces spaces with hyphens", () => {
    expect(normalizeName("my project")).toBe("my-project");
  });

  it("removes special characters", () => {
    expect(normalizeName("my@project!name")).toBe("my-project-name");
  });

  it("trims leading/trailing hyphens", () => {
    expect(normalizeName("--my-project--")).toBe("my-project");
  });

  it("handles empty string", () => {
    expect(normalizeName("")).toBe("");
  });
});

describe("createDirName", () => {
  it("creates date-prefixed name", () => {
    const name = createDirName("my project");
    expect(name).toMatch(/^\d{4}-\d{2}-\d{2}-my-project$/);
  });

  it("handles empty name", () => {
    const name = createDirName("");
    expect(name).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("normalizes the name", () => {
    const name = createDirName("My Cool Project!");
    expect(name).toMatch(/^\d{4}-\d{2}-\d{2}-my-cool-project$/);
  });
});
