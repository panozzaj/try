import Fuse, { type IFuseOptions } from "fuse.js";
import type { TryEntry, ScoredEntry } from "../types.js";

/**
 * Parse a date prefix from a directory name (e.g., "2025-12-12-my-experiment")
 */
export function parseDatePrefix(name: string): { datePrefix?: string; baseName: string } {
  const match = name.match(/^(\d{4}-\d{2}-\d{2})-?(.*)$/);
  if (match) {
    return {
      datePrefix: match[1],
      baseName: match[2] || name,
    };
  }
  return { baseName: name };
}

/**
 * Generate a date prefix for today
 */
export function todayPrefix(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Calculate time-based score (recently accessed = higher score)
 * Returns a value between 0 and 1
 */
export function calculateTimeScore(accessedAt: Date): number {
  const now = Date.now();
  const accessed = accessedAt.getTime();
  const hoursSinceAccess = (now - accessed) / (1000 * 60 * 60);

  // Decay function: score drops to ~0.5 after 24 hours, ~0.1 after a week
  // Using exponential decay with a half-life of about 24 hours
  return Math.exp(-hoursSinceAccess / 24);
}

/**
 * Fuse.js options for fuzzy matching
 */
const FUSE_OPTIONS: IFuseOptions<TryEntry> = {
  keys: ["name", "baseName"],
  threshold: 0.4,
  includeScore: true,
  includeMatches: true,
  ignoreLocation: true,
  minMatchCharLength: 1,
};

/**
 * Score and sort entries based on fuzzy search and time
 */
export function scoreEntries(
  entries: TryEntry[],
  query: string
): ScoredEntry[] {
  if (!query.trim()) {
    // No query: sort by access time only
    return entries
      .map((entry) => {
        const timeScore = calculateTimeScore(entry.accessedAt);
        return {
          ...entry,
          score: timeScore,
          fuzzyScore: 1,
          timeScore,
          matchedIndices: [],
        };
      })
      .sort((a, b) => b.score - a.score);
  }

  const fuse = new Fuse(entries, FUSE_OPTIONS);
  const results = fuse.search(query);

  return results.map((result) => {
    // Fuse score is 0 for perfect match, 1 for no match - invert it
    const fuzzyScore = 1 - (result.score ?? 0);
    const timeScore = calculateTimeScore(result.item.accessedAt);

    // Combine scores: fuzzy match is primary, time is secondary
    // Weight: 70% fuzzy, 30% time
    const combinedScore = fuzzyScore * 0.7 + timeScore * 0.3;

    // Extract matched indices from Fuse results
    const matchedIndices: number[] = [];
    if (result.matches) {
      for (const match of result.matches) {
        if (match.indices) {
          for (const [start, end] of match.indices) {
            for (let i = start; i <= end; i++) {
              if (!matchedIndices.includes(i)) {
                matchedIndices.push(i);
              }
            }
          }
        }
      }
    }

    return {
      ...result.item,
      score: combinedScore,
      fuzzyScore,
      timeScore,
      matchedIndices: matchedIndices.sort((a, b) => a - b),
    };
  });
}

/**
 * Normalize a name for directory creation (kebab-case)
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Create a full directory name with date prefix
 */
export function createDirName(name: string): string {
  const normalized = normalizeName(name);
  const prefix = todayPrefix();
  return normalized ? `${prefix}-${normalized}` : prefix;
}
