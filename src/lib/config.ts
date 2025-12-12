import * as fs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"
import * as yaml from "js-yaml"
import type { TryConfig } from "../types.js"

const DEFAULT_CONFIG: TryConfig = {
  path: path.join(os.homedir(), "src", "tries"),
}

/**
 * Possible config file locations in order of preference
 */
export function getConfigPaths(): string[] {
  const home = os.homedir()
  return [
    path.join(home, ".tryrc"),
    path.join(home, ".tryrc.yaml"),
    path.join(home, ".tryrc.yml"),
    path.join(home, ".config", "try", "config.yaml"),
    path.join(home, ".config", "try", "config.yml"),
  ]
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
  const parsed = yaml.load(content)
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

  if (!configFile) {
    return DEFAULT_CONFIG
  }

  try {
    const content = fs.readFileSync(configFile, "utf-8")
    const parsed = parseConfig(content)

    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      path: expandPath(parsed.path ?? DEFAULT_CONFIG.path),
    }
  } catch (error) {
    console.error(`Warning: Failed to parse config file ${configFile}:`, error)
    return DEFAULT_CONFIG
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
