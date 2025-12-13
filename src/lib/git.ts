import { spawn } from "node:child_process"
import * as path from "node:path"
import type { TryConfig, CloneOptions, WorktreeOptions } from "../types.js"
import { expandPath } from "./config.js"
import { todayPrefix } from "./scoring.js"

interface CommandResult {
  success: boolean
  exitCode: number
  stdout: string
  stderr: string
}

/**
 * Run a command and return the result
 */
function runCommand(command: string, args: string[], cwd?: string): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
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
 * Extract user/repo from git URL and return as "user-repo"
 */
export function extractRepoName(url: string): string {
  // Handle various URL formats:
  // https://github.com/user/repo.git → user-repo
  // git@github.com:user/repo.git → user-repo
  // https://github.com/user/repo → user-repo

  let cleaned = url

  // Remove .git suffix
  if (cleaned.endsWith(".git")) {
    cleaned = cleaned.slice(0, -4)
  }

  // https://github.com/user/repo
  const httpsMatch = cleaned.match(/https?:\/\/[^/]+\/([^/]+)\/([^/]+)/)
  if (httpsMatch) {
    return `${httpsMatch[1]}-${httpsMatch[2]}`
  }

  // git@github.com:user/repo
  const sshMatch = cleaned.match(/git@[^:]+:([^/]+)\/(.+)/)
  if (sshMatch) {
    return `${sshMatch[1]}-${sshMatch[2]}`
  }

  // Fallback: just use last path component
  const lastSlash = cleaned.lastIndexOf("/")
  if (lastSlash !== -1) {
    return cleaned.slice(lastSlash + 1)
  }

  return cleaned
}

/**
 * Clone a git repository into the tries directory
 */
export async function cloneRepo(
  config: TryConfig,
  options: CloneOptions
): Promise<{ success: boolean; path: string; error?: string }> {
  const triesPath = expandPath(config.path)
  const repoName = options.name || extractRepoName(options.url)
  const dirName = `${todayPrefix()}-${repoName}`
  const fullPath = path.join(triesPath, dirName)

  const args = ["clone"]

  if (options.shallow) {
    args.push("--depth", "1")
  }

  args.push(options.url, fullPath)

  const result = await runCommand("git", args)

  if (!result.success) {
    return {
      success: false,
      path: fullPath,
      error: result.stderr || "Clone failed",
    }
  }

  return { success: true, path: fullPath }
}

/**
 * Create a git worktree in the tries directory
 */
export async function createWorktree(
  config: TryConfig,
  options: WorktreeOptions
): Promise<{ success: boolean; path: string; error?: string }> {
  const triesPath = expandPath(config.path)
  const worktreeName = options.name || options.branch.replace(/\//g, "-")
  const dirName = `${todayPrefix()}-${worktreeName}`
  const fullPath = path.join(triesPath, dirName)

  const args = ["worktree", "add"]

  if (options.createBranch) {
    args.push("-b", options.branch)
    args.push(fullPath)
  } else {
    args.push(fullPath, options.branch)
  }

  const result = await runCommand("git", args)

  if (!result.success) {
    return {
      success: false,
      path: fullPath,
      error: result.stderr || "Worktree creation failed",
    }
  }

  return { success: true, path: fullPath }
}

/**
 * Check if a directory is inside a git repository
 */
export async function isInGitRepo(cwd?: string): Promise<boolean> {
  const result = await runCommand("git", ["rev-parse", "--git-dir"], cwd)
  return result.success
}

/**
 * Get the root directory of the git repository
 */
export async function getGitRoot(cwd?: string): Promise<string | null> {
  const result = await runCommand("git", ["rev-parse", "--show-toplevel"], cwd)
  if (result.success) {
    return result.stdout.trim()
  }
  return null
}

/**
 * Get the current git branch
 */
export async function getCurrentBranch(): Promise<string | null> {
  const result = await runCommand("git", ["branch", "--show-current"])
  if (result.success) {
    return result.stdout.trim()
  }
  return null
}

/**
 * Create a detached worktree from a git repository
 * This creates a worktree at HEAD without checking out a branch
 */
export async function createDetachedWorktree(
  config: TryConfig,
  repoPath: string,
  name: string
): Promise<{ success: boolean; path: string; error?: string }> {
  const triesPath = expandPath(config.path)
  const dirName = `${todayPrefix()}-${name}`
  const fullPath = path.join(triesPath, dirName)

  // Get the git root from the repo path
  const gitRoot = await getGitRoot(repoPath)
  if (!gitRoot) {
    return {
      success: false,
      path: fullPath,
      error: "Not a git repository",
    }
  }

  // Create a detached worktree
  const result = await runCommand("git", ["worktree", "add", "--detach", fullPath], gitRoot)

  if (!result.success) {
    return {
      success: false,
      path: fullPath,
      error: result.stderr || "Worktree creation failed",
    }
  }

  return { success: true, path: fullPath }
}
