import { spawn } from "node:child_process"
import * as fs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"
import type { TryConfig, CallbackHook, CallbackResult } from "../types.js"

/**
 * Execute a callback script
 *
 * Callbacks can be:
 * - Inline shell script (multi-line string)
 * - Path to executable (starts with / or ~)
 *
 * The callback receives the directory path as $1
 */
export async function executeCallback(
  config: TryConfig,
  hook: CallbackHook,
  dirPath: string
): Promise<CallbackResult> {
  const callbackScript = config.callbacks?.[hook]

  if (!callbackScript) {
    return {
      success: true,
      exitCode: 0,
      stdout: "",
      stderr: "",
    }
  }

  const script = expandCallbackPath(callbackScript)

  return new Promise((resolve) => {
    // Determine if it's a file path or inline script
    const isFilePath = script.startsWith("/") || script.startsWith("~") || script.startsWith("./")

    let command: string
    let args: string[]

    if (isFilePath) {
      // It's a path to an executable
      const expandedPath = expandPath(script)
      if (!fs.existsSync(expandedPath)) {
        resolve({
          success: false,
          exitCode: 127,
          stdout: "",
          stderr: `Callback script not found: ${expandedPath}`,
        })
        return
      }
      command = expandedPath
      args = [dirPath]
    } else {
      // It's an inline script - run with bash
      command = "/bin/bash"
      args = ["-c", script, "--", dirPath]
    }

    const child = spawn(command, args, {
      cwd: dirPath,
      env: {
        ...process.env,
        TRY_DIR: dirPath,
        TRY_HOOK: hook,
      },
      stdio: ["ignore", "pipe", "pipe"],
    })

    let stdout = ""
    let stderr = ""

    child.stdout.on("data", (data) => {
      stdout += data.toString()
    })

    child.stderr.on("data", (data) => {
      stderr += data.toString()
    })

    child.on("error", (error) => {
      resolve({
        success: false,
        exitCode: 1,
        stdout,
        stderr: stderr + error.message,
      })
    })

    child.on("close", (code) => {
      resolve({
        success: code === 0,
        exitCode: code ?? 1,
        stdout,
        stderr,
      })
    })
  })
}

/**
 * Expand ~ in callback path
 */
function expandCallbackPath(script: string): string {
  if (script.startsWith("~/")) {
    return path.join(os.homedir(), script.slice(2))
  }
  return script
}

/**
 * Expand ~ in any path
 */
function expandPath(p: string): string {
  if (p.startsWith("~/")) {
    return path.join(os.homedir(), p.slice(2))
  }
  return p
}

/**
 * Check if a hook has a callback configured
 */
export function hasCallback(config: TryConfig, hook: CallbackHook): boolean {
  return !!config.callbacks?.[hook]
}

/**
 * Run before_delete callback and check if deletion should proceed
 * Returns true if deletion should proceed, false if aborted
 */
export async function runBeforeDelete(
  config: TryConfig,
  dirPath: string
): Promise<{ proceed: boolean; message?: string }> {
  if (!hasCallback(config, "before_delete")) {
    return { proceed: true }
  }

  const result = await executeCallback(config, "before_delete", dirPath)

  if (!result.success) {
    return {
      proceed: false,
      message: result.stderr || `Callback exited with code ${result.exitCode}`,
    }
  }

  return { proceed: true }
}

/**
 * Run an init action command
 */
export async function runInitAction(command: string, dirPath: string): Promise<CallbackResult> {
  return new Promise((resolve) => {
    const child = spawn("/bin/bash", ["-c", command, "--", dirPath], {
      cwd: dirPath,
      env: {
        ...process.env,
        TRY_DIR: dirPath,
      },
      stdio: ["ignore", "pipe", "pipe"],
    })

    let stdout = ""
    let stderr = ""

    child.stdout.on("data", (data) => {
      stdout += data.toString()
    })

    child.stderr.on("data", (data) => {
      stderr += data.toString()
    })

    child.on("error", (error) => {
      resolve({
        success: false,
        exitCode: 1,
        stdout,
        stderr: stderr + error.message,
      })
    })

    child.on("close", (code) => {
      resolve({
        success: code === 0,
        exitCode: code ?? 1,
        stdout,
        stderr,
      })
    })
  })
}

/**
 * Extract base name from a dated directory name
 * e.g., "2025-12-12-my-app" -> "my-app"
 */
function extractBaseName(dirName: string): string {
  const match = dirName.match(/^\d{4}-\d{2}-\d{2}-(.+)$/)
  return match ? match[1] : dirName
}

/**
 * Convert a name to a valid identifier (underscore_case)
 * e.g., "my-app" -> "my_app"
 */
function toIdentifier(name: string): string {
  return name.replace(/-/g, "_")
}

/**
 * Run a template command to scaffold a project
 *
 * Unlike init actions, templates run in the parent directory (tries path)
 * and are expected to create the target directory themselves.
 *
 * The command receives:
 *   $1 = directory name (e.g., "2025-12-12-myapp")
 *   TRY_DIR = full path
 *   TRY_NAME = directory name (e.g., "2025-12-12-myapp")
 *   TRY_BASE = base name without date (e.g., "myapp")
 *   TRY_ID = identifier-safe name (e.g., "my_app")
 */
export async function runTemplate(
  command: string,
  triesPath: string,
  fullPath: string
): Promise<CallbackResult> {
  const dirName = path.basename(fullPath)
  const baseName = extractBaseName(dirName)
  const identifier = toIdentifier(baseName)

  return new Promise((resolve) => {
    const child = spawn("/bin/bash", ["-c", command, "--", dirName], {
      cwd: triesPath,
      env: {
        ...process.env,
        TRY_DIR: fullPath,
        TRY_NAME: dirName,
        TRY_BASE: baseName,
        TRY_ID: identifier,
      },
      stdio: ["inherit", "pipe", "pipe"],
    })

    let stdout = ""
    let stderr = ""

    child.stdout.on("data", (data) => {
      stdout += data.toString()
    })

    child.stderr.on("data", (data) => {
      stderr += data.toString()
    })

    child.on("error", (error) => {
      resolve({
        success: false,
        exitCode: 1,
        stdout,
        stderr: stderr + error.message,
      })
    })

    child.on("close", (code) => {
      resolve({
        success: code === 0,
        exitCode: code ?? 1,
        stdout,
        stderr,
      })
    })
  })
}
