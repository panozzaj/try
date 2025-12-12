import { spawn } from "node:child_process";
import * as path from "node:path";
import type { TryConfig, CloneOptions, WorktreeOptions } from "../types.js";
import { expandPath } from "./config.js";
import { todayPrefix } from "./scoring.js";

interface CommandResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Run a command and return the result
 */
function runCommand(
  command: string,
  args: string[],
  cwd?: string
): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", (error) => {
      resolve({
        success: false,
        exitCode: 1,
        stdout,
        stderr: stderr + error.message,
      });
    });

    child.on("close", (code) => {
      resolve({
        success: code === 0,
        exitCode: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
}

/**
 * Extract repo name from git URL
 */
export function extractRepoName(url: string): string {
  // Handle various URL formats:
  // https://github.com/user/repo.git
  // git@github.com:user/repo.git
  // https://github.com/user/repo
  // user/repo (GitHub shorthand)

  let name = url;

  // Remove .git suffix
  if (name.endsWith(".git")) {
    name = name.slice(0, -4);
  }

  // Extract last path component
  const lastSlash = name.lastIndexOf("/");
  if (lastSlash !== -1) {
    name = name.slice(lastSlash + 1);
  }

  // Handle git@host:user/repo format
  const colonIndex = name.indexOf(":");
  if (colonIndex !== -1 && !name.includes("/")) {
    name = name.slice(colonIndex + 1);
    const slash = name.lastIndexOf("/");
    if (slash !== -1) {
      name = name.slice(slash + 1);
    }
  }

  return name;
}

/**
 * Clone a git repository into the tries directory
 */
export async function cloneRepo(
  config: TryConfig,
  options: CloneOptions
): Promise<{ success: boolean; path: string; error?: string }> {
  const triesPath = expandPath(config.path);
  const repoName = options.name || extractRepoName(options.url);
  const dirName = `${todayPrefix()}-${repoName}`;
  const fullPath = path.join(triesPath, dirName);

  const args = ["clone"];

  if (options.shallow) {
    args.push("--depth", "1");
  }

  args.push(options.url, fullPath);

  const result = await runCommand("git", args);

  if (!result.success) {
    return {
      success: false,
      path: fullPath,
      error: result.stderr || "Clone failed",
    };
  }

  return { success: true, path: fullPath };
}

/**
 * Create a git worktree in the tries directory
 */
export async function createWorktree(
  config: TryConfig,
  options: WorktreeOptions
): Promise<{ success: boolean; path: string; error?: string }> {
  const triesPath = expandPath(config.path);
  const worktreeName = options.name || options.branch.replace(/\//g, "-");
  const dirName = `${todayPrefix()}-${worktreeName}`;
  const fullPath = path.join(triesPath, dirName);

  const args = ["worktree", "add"];

  if (options.createBranch) {
    args.push("-b", options.branch);
    args.push(fullPath);
  } else {
    args.push(fullPath, options.branch);
  }

  const result = await runCommand("git", args);

  if (!result.success) {
    return {
      success: false,
      path: fullPath,
      error: result.stderr || "Worktree creation failed",
    };
  }

  return { success: true, path: fullPath };
}

/**
 * Check if we're currently in a git repository
 */
export async function isInGitRepo(): Promise<boolean> {
  const result = await runCommand("git", ["rev-parse", "--git-dir"]);
  return result.success;
}

/**
 * Get the current git branch
 */
export async function getCurrentBranch(): Promise<string | null> {
  const result = await runCommand("git", ["branch", "--show-current"]);
  if (result.success) {
    return result.stdout.trim();
  }
  return null;
}
