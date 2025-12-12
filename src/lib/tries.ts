import * as fs from "node:fs"
import * as path from "node:path"
import type { TryEntry, TryConfig } from "../types.js"
import { parseDatePrefix } from "./scoring.js"
import { expandPath } from "./config.js"

/**
 * Load all try entries from the configured directory
 */
export function loadTries(config: TryConfig): TryEntry[] {
  const triesPath = expandPath(config.path)

  if (!fs.existsSync(triesPath)) {
    return []
  }

  const entries: TryEntry[] = []

  try {
    const dirents = fs.readdirSync(triesPath, { withFileTypes: true })

    for (const dirent of dirents) {
      if (!dirent.isDirectory()) continue
      if (dirent.name.startsWith(".")) continue

      const fullPath = path.join(triesPath, dirent.name)
      const stats = fs.statSync(fullPath)
      const { datePrefix, baseName } = parseDatePrefix(dirent.name)

      entries.push({
        path: fullPath,
        name: dirent.name,
        createdAt: stats.birthtime,
        accessedAt: stats.atime,
        modifiedAt: stats.mtime,
        datePrefix,
        baseName,
      })
    }
  } catch (error) {
    console.error(`Error reading tries directory ${triesPath}:`, error)
  }

  return entries
}

/**
 * Create a new try directory
 */
export function createTryDir(config: TryConfig, name: string): string {
  const triesPath = expandPath(config.path)
  const fullPath = path.join(triesPath, name)

  if (fs.existsSync(fullPath)) {
    throw new Error(`Directory already exists: ${fullPath}`)
  }

  fs.mkdirSync(fullPath, { recursive: true })
  return fullPath
}

/**
 * Delete a try directory
 */
export function deleteTryDir(entryPath: string): void {
  if (!fs.existsSync(entryPath)) {
    throw new Error(`Directory does not exist: ${entryPath}`)
  }

  fs.rmSync(entryPath, { recursive: true, force: true })
}

/**
 * Check if a directory name already exists
 */
export function tryExists(config: TryConfig, name: string): boolean {
  const triesPath = expandPath(config.path)
  const fullPath = path.join(triesPath, name)
  return fs.existsSync(fullPath)
}

/**
 * Get full path for a try directory
 */
export function getTryPath(config: TryConfig, name: string): string {
  const triesPath = expandPath(config.path)
  return path.join(triesPath, name)
}

/**
 * Touch a directory to update its access time
 */
export function touchTryDir(entryPath: string): void {
  const now = new Date()
  try {
    fs.utimesSync(entryPath, now, now)
  } catch {
    // Ignore errors - not critical
  }
}
