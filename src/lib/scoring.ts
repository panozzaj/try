import { Fzf, type FzfResultItem } from "fzf"
import type { TryEntry, ScoredEntry } from "../types.js"

/**
 * Parse a date prefix from a directory name (e.g., "2025-12-12-my-experiment")
 */
export function parseDatePrefix(name: string): { datePrefix?: string; baseName: string } {
  const match = name.match(/^(\d{4}-\d{2}-\d{2})-?(.*)$/)
  if (match) {
    return {
      datePrefix: match[1],
      baseName: match[2] || name,
    }
  }
  return { baseName: name }
}

/**
 * Generate a date prefix for today
 */
export function todayPrefix(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * Calculate time-based score (recently modified = higher score)
 * Uses mtime (modification time) not atime, since atime gets updated on reads.
 * We explicitly touch directories on selection to update mtime.
 * Returns a value between 0 and 1
 */
export function calculateTimeScore(modifiedAt: Date): number {
  const now = Date.now()
  const modified = modifiedAt.getTime()
  const hoursSinceModified = (now - modified) / (1000 * 60 * 60)

  // Match tobi/try's scoring: 3.0 / sqrt(hours + 1)
  // Normalize to 0-1 range (3.0 is max when hours=0)
  return Math.min(1, 3.0 / Math.sqrt(hoursSinceModified + 1) / 3.0)
}

/**
 * Score and sort entries based on fzf search and time
 */
export function scoreEntries(entries: TryEntry[], query: string): ScoredEntry[] {
  if (!query.trim()) {
    // No query: sort by modification time only
    return entries
      .map((entry) => {
        const timeScore = calculateTimeScore(entry.modifiedAt)
        return {
          ...entry,
          score: timeScore,
          fuzzyScore: 1,
          timeScore,
          matchedIndices: [],
        }
      })
      .sort((a, b) => b.score - a.score)
  }

  // Use fzf for subsequence matching (like the real fzf CLI)
  const fzf = new Fzf(entries, {
    selector: (entry) => entry.name,
  })
  const results = fzf.find(query)

  return results.map((result: FzfResultItem<TryEntry>) => {
    // fzf score is higher = better match (opposite of Fuse.js)
    // Normalize to 0-1 range (typical scores range from 0 to ~100+)
    const fuzzyScore = Math.min(1, result.score / 100)
    const timeScore = calculateTimeScore(result.item.modifiedAt)

    // Combine scores: fuzzy match is primary, time is secondary
    // Weight: 70% fuzzy, 30% time
    const combinedScore = fuzzyScore * 0.7 + timeScore * 0.3

    // fzf provides positions as a Set
    const matchedIndices = Array.from(result.positions).sort((a, b) => a - b)

    return {
      ...result.item,
      score: combinedScore,
      fuzzyScore,
      timeScore,
      matchedIndices,
    }
  })
}

/**
 * Normalize a name for directory creation (kebab-case)
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * Create a full directory name with date prefix
 */
export function createDirName(name: string): string {
  const normalized = normalizeName(name)
  const prefix = todayPrefix()
  return normalized ? `${prefix}-${normalized}` : prefix
}
