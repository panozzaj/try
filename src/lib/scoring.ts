import Fuse, { type IFuseOptions } from "fuse.js"
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
 * Fuse.js options for fuzzy matching
 */
const FUSE_OPTIONS: IFuseOptions<TryEntry> = {
  keys: ["name", "baseName"],
  threshold: 0.6, // Allow abbreviation matches like "sr" → "spaced-repetition"
  includeScore: true,
  includeMatches: true,
  ignoreLocation: true,
  minMatchCharLength: 1,
}

/**
 * Score and sort entries based on fuzzy search and time
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

  const fuse = new Fuse(entries, FUSE_OPTIONS)
  const results = fuse.search(query)

  return results.map((result) => {
    // Fuse score is 0 for perfect match, 1 for no match - invert it
    const fuzzyScore = 1 - (result.score ?? 0)
    const timeScore = calculateTimeScore(result.item.modifiedAt)

    // Combine scores: fuzzy match is primary, time is secondary
    // Weight: 70% fuzzy, 30% time
    const combinedScore = fuzzyScore * 0.7 + timeScore * 0.3

    // Extract matched indices from Fuse results (only for "name" key)
    const matchedIndices: number[] = []
    if (result.matches) {
      for (const match of result.matches) {
        // Only use indices from the "name" field, not "baseName"
        if (match.key === "name" && match.indices && match.value) {
          const queryLower = query.toLowerCase()

          // First, try to find a contiguous range containing the full query
          let foundExactMatch = false
          for (const [start, end] of match.indices) {
            const slice = match.value.slice(start, end + 1).toLowerCase()
            if (slice.length >= queryLower.length && slice.includes(queryLower)) {
              // Found exact substring match - highlight only the query chars
              const queryStart = slice.indexOf(queryLower)
              for (let i = 0; i < queryLower.length; i++) {
                const idx = start + queryStart + i
                if (!matchedIndices.includes(idx)) {
                  matchedIndices.push(idx)
                }
              }
              foundExactMatch = true
            }
          }

          // If no exact match, use individual character matches (for abbreviations)
          // Only include if total matched chars equals query length
          if (!foundExactMatch) {
            const abbrevIndices: number[] = []
            for (const [start, end] of match.indices) {
              for (let i = start; i <= end; i++) {
                abbrevIndices.push(i)
              }
            }
            // Verify the matched characters spell out the query
            if (abbrevIndices.length === queryLower.length) {
              const matchedChars = abbrevIndices.map((i) => match.value![i].toLowerCase()).join("")
              if (matchedChars === queryLower) {
                for (const idx of abbrevIndices) {
                  if (!matchedIndices.includes(idx)) {
                    matchedIndices.push(idx)
                  }
                }
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
