import * as fs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"
import type { TryConfig } from "../types.js"

/**
 * Get the user's home directory, respecting HOME env var for testing
 */
function getHomeDir(): string {
  return process.env.HOME || os.homedir()
}

/**
 * Get the default config with the correct home directory
 */
function getDefaultConfig(): TryConfig {
  // TRY_PATH env var allows overriding the tries directory (useful for testing)
  const triesPath = process.env.TRY_PATH || path.join(getHomeDir(), "src", "tries")
  return {
    path: triesPath,
  }
}

/**
 * Possible config file locations in order of preference
 */
export function getConfigPaths(): string[] {
  const home = getHomeDir()
  return [path.join(home, ".tryrc.json"), path.join(home, ".config", "try", "config.json")]
}

/**
 * Find the first existing config file
 */
export function findConfigFile(): string | null {
  for (const configPath of getConfigPaths()) {
    if (fs.existsSync(configPath)) {
      return configPath
    }
  }
  return null
}

/**
 * Parse a config file and return the configuration
 */
export function parseConfig(content: string): Partial<TryConfig> {
  const parsed = JSON.parse(content)
  if (typeof parsed !== "object" || parsed === null) {
    return {}
  }
  return parsed as Partial<TryConfig>
}

/**
 * Expand ~ and environment variables in path
 */
export function expandPath(p: string): string {
  if (p.startsWith("~/")) {
    return path.join(os.homedir(), p.slice(2))
  }
  if (p.startsWith("~")) {
    return path.join(os.homedir(), p.slice(1))
  }
  return p
}

/**
 * Load configuration from file, falling back to defaults
 */
export function loadConfig(): TryConfig {
  const configFile = findConfigFile()
  const defaultConfig = getDefaultConfig()

  if (!configFile) {
    return defaultConfig
  }

  try {
    const content = fs.readFileSync(configFile, "utf-8")
    const parsed = parseConfig(content)

    return {
      ...defaultConfig,
      ...parsed,
      path: expandPath(parsed.path ?? defaultConfig.path),
    }
  } catch (error) {
    console.error(`Warning: Failed to parse config file ${configFile}:`, error)
    return defaultConfig
  }
}

/**
 * Ensure the tries directory exists
 */
export function ensureTriesDir(config: TryConfig): void {
  const triesPath = expandPath(config.path)
  if (!fs.existsSync(triesPath)) {
    fs.mkdirSync(triesPath, { recursive: true })
  }
}
