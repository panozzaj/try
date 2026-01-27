import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

/**
 * Get the Claude projects folder path for a directory
 * @param dirPath - The directory path to get Claude projects path for
 * @param homeDir - Optional home directory override (for testing)
 */
export function getClaudeProjectsPath(dirPath: string, homeDir?: string): string {
  const home = homeDir ?? os.homedir()
  const encodedPath = dirPath.replace(/\//g, "-")
  return path.join(home, ".claude", "projects", encodedPath)
}

/**
 * Check if a Claude projects folder exists for a directory
 * @param dirPath - The directory path to check
 * @param homeDir - Optional home directory override (for testing)
 */
export function hasClaudeProjectsFolder(dirPath: string, homeDir?: string): boolean {
  return fs.existsSync(getClaudeProjectsPath(dirPath, homeDir))
}

/**
 * Validate that a jsonl file looks like a Claude session file
 * Returns true if safe to modify, false if structure is unexpected
 */
export function validateSessionFile(filePath: string): { valid: boolean; error?: string } {
  try {
    const content = fs.readFileSync(filePath, "utf-8")
    const lines = content.trim().split("\n")

    if (lines.length === 0) {
      return { valid: true } // Empty file is fine
    }

    // Check first few lines to validate structure
    const linesToCheck = Math.min(5, lines.length)
    for (let i = 0; i < linesToCheck; i++) {
      const line = lines[i].trim()
      if (!line) continue

      try {
        const parsed = JSON.parse(line)

        // Expected fields in Claude session entries
        // Sessions should have objects with fields like: type, uuid, timestamp, message, cwd, sessionId
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          return {
            valid: false,
            error: `Line ${i + 1}: Expected object, got ${Array.isArray(parsed) ? "array" : typeof parsed}`,
          }
        }

        // If it has a cwd field, it should be a string path
        if ("cwd" in parsed && typeof parsed.cwd !== "string") {
          return { valid: false, error: `Line ${i + 1}: cwd field is not a string` }
        }

        // Should have at least one of the expected session fields
        const expectedFields = ["type", "uuid", "timestamp", "message", "sessionId", "snapshot"]
        const hasExpectedField = expectedFields.some((f) => f in parsed)
        if (!hasExpectedField) {
          return {
            valid: false,
            error: `Line ${i + 1}: Missing expected session fields (type, uuid, timestamp, etc.)`,
          }
        }
      } catch {
        return { valid: false, error: `Line ${i + 1}: Invalid JSON` }
      }
    }

    return { valid: true }
  } catch (err) {
    return { valid: false, error: `Failed to read file: ${err}` }
  }
}

/**
 * Result of renaming Claude projects folder
 */
export interface RenameClaudeProjectsResult {
  success: boolean
  error?: string
  filesModified: number
  folderRenamed: boolean
}

/**
 * Rename a Claude projects folder and update cwd paths in session files
 * @param oldDirPath - The old directory path
 * @param newDirPath - The new directory path
 * @param homeDir - Optional home directory override (for testing)
 */
export function renameClaudeProjectsFolder(
  oldDirPath: string,
  newDirPath: string,
  homeDir?: string
): RenameClaudeProjectsResult {
  const oldClaudePath = getClaudeProjectsPath(oldDirPath, homeDir)
  const newClaudePath = getClaudeProjectsPath(newDirPath, homeDir)

  if (!fs.existsSync(oldClaudePath)) {
    return { success: true, filesModified: 0, folderRenamed: false }
  }

  // Check if target already exists
  if (fs.existsSync(newClaudePath)) {
    return {
      success: false,
      error: `Target Claude projects folder already exists: ${newClaudePath}`,
      filesModified: 0,
      folderRenamed: false,
    }
  }

  // Validate all jsonl files before modifying any
  const files = fs.readdirSync(oldClaudePath)
  const jsonlFiles = files.filter((f) => f.endsWith(".jsonl"))

  for (const file of jsonlFiles) {
    const filePath = path.join(oldClaudePath, file)
    const validation = validateSessionFile(filePath)
    if (!validation.valid) {
      return {
        success: false,
        error: `Unexpected file structure in ${file}: ${validation.error}`,
        filesModified: 0,
        folderRenamed: false,
      }
    }
  }

  // All files validated, now modify them
  let filesModified = 0
  const escapedOldPath = oldDirPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const cwdPattern = new RegExp(`"cwd":"${escapedOldPath}"`, "g")

  for (const file of jsonlFiles) {
    const filePath = path.join(oldClaudePath, file)
    const content = fs.readFileSync(filePath, "utf-8")
    const updated = content.replace(cwdPattern, `"cwd":"${newDirPath}"`)

    if (updated !== content) {
      fs.writeFileSync(filePath, updated)
      filesModified++
    }
  }

  // Rename the folder
  fs.renameSync(oldClaudePath, newClaudePath)

  return { success: true, filesModified, folderRenamed: true }
}
