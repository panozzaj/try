#!/usr/bin/env node
import React from "react"
import { render } from "ink"
import * as fs from "node:fs"
import * as tty from "node:tty"
import { Selector } from "./components/Selector.js"
import { InitActions } from "./components/InitActions.js"
import { loadConfig, ensureTriesDir } from "./lib/config.js"
import { createTryDir, deleteTryDir, touchTryDir } from "./lib/tries.js"
import { executeCallback, runBeforeDelete, runInitAction } from "./lib/callbacks.js"
import { cloneRepo, isInGitRepo, createDetachedWorktree } from "./lib/git.js"
import { generateShellInit, detectShell, generateCdCommand } from "./lib/shell.js"
import type { SelectorResult, ShellType, TryConfig } from "./types.js"

const config = loadConfig()

/**
 * Check if a string looks like a git URL
 */
function isGitUrl(str: string): boolean {
  return (
    str.startsWith("https://") ||
    str.startsWith("git@") ||
    str.includes("github.com") ||
    str.includes("gitlab.com") ||
    str.endsWith(".git")
  )
}

/**
 * Get a TTY stream for Ink rendering.
 */
function getTtyStream(): tty.WriteStream | undefined {
  try {
    const ttyFd = fs.openSync("/dev/tty", "w")
    return new tty.WriteStream(ttyFd)
  } catch {
    // /dev/tty not available
  }

  if (process.stderr?.isTTY) {
    return process.stderr as tty.WriteStream
  }

  return undefined
}

/**
 * Show init actions selector and run selected actions
 */
async function runInitActions(cfg: TryConfig, dirPath: string): Promise<void> {
  if (!cfg.init_actions || Object.keys(cfg.init_actions).length === 0) {
    return
  }

  const ttyStream = getTtyStream()

  return new Promise((resolve) => {
    const { unmount } = render(
      <InitActions
        actions={cfg.init_actions!}
        onConfirm={async (selectedKeys) => {
          unmount()
          for (const key of selectedKeys) {
            const action = cfg.init_actions![key]
            console.error(`Running: ${action.label}`)
            const result = await runInitAction(action.command, dirPath)
            if (!result.success) {
              console.error(`  Failed: ${result.stderr}`)
            }
          }
          resolve()
        }}
        onSkip={() => {
          unmount()
          resolve()
        }}
      />,
      { stdout: ttyStream }
    )
  })
}

/**
 * Handle the result from the selector UI
 */
async function handleSelectorResult(result: SelectorResult): Promise<void> {
  switch (result.action) {
    case "select": {
      touchTryDir(result.entry.path)
      await executeCallback(config, "after_select", result.entry.path)
      console.log(generateCdCommand(result.entry.path))
      break
    }

    case "create": {
      const fullPath = createTryDir(config, result.name)
      await runInitActions(config, fullPath)
      await executeCallback(config, "after_create", fullPath)
      console.log(generateCdCommand(fullPath))
      break
    }

    case "delete": {
      const { proceed, message } = await runBeforeDelete(config, result.entry.path)

      if (!proceed) {
        console.error(`Delete aborted: ${message}`)
        process.exit(1)
      }

      deleteTryDir(result.entry.path)
      console.error(`Deleted: ${result.entry.name}`)
      break
    }

    case "cancel":
      break
  }
}

/**
 * Run the interactive selector
 */
function runSelector(initialQuery: string = ""): Promise<SelectorResult> {
  const ttyStream = getTtyStream()

  return new Promise((resolve) => {
    const { unmount } = render(
      <Selector
        config={config}
        initialQuery={initialQuery}
        onResult={(result) => {
          unmount()
          resolve(result)
        }}
      />,
      { stdout: ttyStream }
    )
  })
}

/**
 * Clone a git repository
 */
async function handleClone(url: string): Promise<void> {
  ensureTriesDir(config)

  const result = await cloneRepo(config, { url })

  if (!result.success) {
    console.error(`Clone failed: ${result.error}`)
    process.exit(1)
  }

  await executeCallback(config, "after_clone", result.path)
  console.log(generateCdCommand(result.path))
}

/**
 * Create a worktree from a git repository
 * If not in a git repo, falls back to creating a regular directory
 */
async function handleWorktree(repoPath: string, name: string): Promise<void> {
  ensureTriesDir(config)

  const inGitRepo = await isInGitRepo(repoPath)

  if (inGitRepo) {
    const result = await createDetachedWorktree(config, repoPath, name)

    if (!result.success) {
      console.error(`Worktree failed: ${result.error}`)
      process.exit(1)
    }

    console.error(`Created worktree from ${repoPath}`)
    await executeCallback(config, "after_create", result.path)
    console.log(generateCdCommand(result.path))
  } else {
    // Not a git repo, just create a regular directory
    const fullPath = createTryDir(config, name)
    await runInitActions(config, fullPath)
    await executeCallback(config, "after_create", fullPath)
    console.log(generateCdCommand(fullPath))
  }
}

/**
 * Show configuration
 */
function showConfig(): void {
  console.log(JSON.stringify(config, null, 2))
}

/**
 * Show help
 */
function showHelp(): void {
  console.log(`try-ink - Interactive directory selector for experiments

Usage:
  try                     Interactive selector
  try <query>             Selector with search pre-filled
  try <git-url>           Clone repository into tries
  try . <name>            Create worktree from current git repo
  try init [shell]        Output shell integration script
  try config              Show configuration

Keyboard:
  ↑↓          Navigate
  Enter       Select / Create new
  Ctrl-D      Delete (requires typing name to confirm)
  Esc         Cancel

Shell integration:
  eval "$(try-ink init)"  Add to ~/.zshrc or ~/.bashrc`)
}

// Main
async function main(): Promise<void> {
  const args = process.argv.slice(2)

  // Handle flags
  if (args.includes("-h") || args.includes("--help")) {
    showHelp()
    return
  }

  if (args.includes("-V") || args.includes("--version")) {
    console.log("0.1.0")
    return
  }

  // Handle commands
  const command = args[0]

  if (command === "init") {
    const shellType: ShellType = (args[1] as ShellType) || detectShell()
    console.log(generateShellInit(shellType))
    return
  }

  if (command === "config") {
    showConfig()
    return
  }

  // Git URL → clone
  if (command && isGitUrl(command)) {
    await handleClone(command)
    return
  }

  // Worktree: try . <name> or try ./path <name>
  if (command && command.startsWith(".")) {
    const repoPath = command === "." ? process.cwd() : command
    const name = args.slice(1).join(" ")

    if (!name) {
      console.error("Error: 'try .' requires a name argument")
      console.error("Usage: try . <name>")
      process.exit(1)
    }

    await handleWorktree(repoPath, name)
    return
  }

  // Default: interactive selector (with optional initial query)
  ensureTriesDir(config)
  const initialQuery = args.join(" ")
  const result = await runSelector(initialQuery)
  await handleSelectorResult(result)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
