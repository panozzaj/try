#!/usr/bin/env node
import React from "react"
import { render } from "ink"
import * as fs from "node:fs"
import * as os from "node:os"
import * as tty from "node:tty"
import { Selector } from "./components/Selector.js"
import { InitActions } from "./components/InitActions.js"
import { TemplateSelector } from "./components/TemplateSelector.js"
import { StartupConfirm } from "./components/StartupConfirm.js"
import { loadConfig, ensureTriesDir, expandPath } from "./lib/config.js"
import { createTryDir, deleteTryDir, touchTryDir, loadTries } from "./lib/tries.js"
import { executeCallback, runBeforeDelete, runInitAction, runTemplate } from "./lib/callbacks.js"
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
 * Ask user if they want to run the startup command
 */
async function confirmStartup(command: string): Promise<boolean> {
  const ttyStream = getTtyStream()

  // Skip confirmation if stdin is not a TTY (e.g., in tests or CI)
  if (!process.stdin.isTTY) {
    return false
  }

  return new Promise((resolve) => {
    const { unmount } = render(
      <StartupConfirm
        command={command}
        onConfirm={() => {
          unmount()
          resolve(true)
        }}
        onSkip={() => {
          unmount()
          resolve(false)
        }}
      />,
      { stdout: ttyStream }
    )
  })
}

/**
 * Show template selector and return selected template key (or null for empty dir)
 */
async function selectTemplate(cfg: TryConfig): Promise<string | null | "cancel"> {
  if (!cfg.templates || Object.keys(cfg.templates).length === 0) {
    return null
  }

  const ttyStream = getTtyStream()

  return new Promise((resolve) => {
    const { unmount } = render(
      <TemplateSelector
        templates={cfg.templates!}
        onSelect={(templateKey) => {
          unmount()
          resolve(templateKey)
        }}
        onCancel={() => {
          unmount()
          resolve("cancel")
        }}
      />,
      { stdout: ttyStream }
    )
  })
}

/**
 * Create a new try directory, optionally using a template
 * Note: `name` is already the full dir name with date prefix (from Selector)
 */
async function createWithTemplate(
  cfg: TryConfig,
  name: string,
  templateKey: string | null
): Promise<string> {
  const triesPath = expandPath(cfg.path)
  const fullPath = `${triesPath}/${name}`

  // Check if directory already exists
  if (fs.existsSync(fullPath)) {
    console.error(`Error: Directory already exists: ${fullPath}`)
    process.exit(1)
  }

  if (templateKey && cfg.templates?.[templateKey]) {
    const command = cfg.templates[templateKey]
    console.error(`Running template: ${templateKey}`)
    const result = await runTemplate(command, triesPath, fullPath)
    if (!result.success) {
      console.error(`Template failed: ${result.stderr}`)
      process.exit(1)
    }
  } else {
    fs.mkdirSync(fullPath, { recursive: true })
  }

  return fullPath
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
      // If templates are configured, let user choose one
      const templateKey = await selectTemplate(config)
      if (templateKey === "cancel") {
        break
      }

      const fullPath = await createWithTemplate(config, result.name, templateKey)
      await runInitActions(config, fullPath)
      await executeCallback(config, "after_create", fullPath)
      const runStartup = config.startup_command && (await confirmStartup(config.startup_command))
      console.log(generateCdCommand(fullPath, runStartup ? config.startup_command : undefined))
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

    case "archive": {
      const triesPath = expandPath(config.path)
      const archiveDir = `${triesPath}/archive`

      // Create archive directory if it doesn't exist
      if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true })
      }

      const targetPath = `${archiveDir}/${result.entry.name}`

      // Check if target already exists
      if (fs.existsSync(targetPath)) {
        console.error(`Error: Already archived: ${targetPath}`)
        process.exit(1)
      }

      fs.renameSync(result.entry.path, targetPath)
      console.error(`Archived: ${result.entry.name}`)
      break
    }

    case "promote": {
      const sourcePath = result.entry.path
      const targetPath = result.targetPath

      // Check if target already exists
      if (fs.existsSync(targetPath)) {
        console.error(`Error: Target already exists: ${targetPath}`)
        process.exit(1)
      }

      // Move the directory
      fs.renameSync(sourcePath, targetPath)
      console.error(`Promoted: ${result.entry.name} → ${targetPath}`)
      console.log(generateCdCommand(targetPath))
      break
    }

    case "rename": {
      const triesPath = expandPath(config.path)
      const sourcePath = fs.realpathSync(result.entry.path)
      const targetPath = `${triesPath}/${result.newName}`
      const cwd = fs.realpathSync(process.cwd())

      // Check if target already exists
      if (fs.existsSync(targetPath)) {
        console.error(`Error: Target already exists: ${targetPath}`)
        process.exit(1)
      }

      // Rename the directory
      fs.renameSync(sourcePath, targetPath)
      console.error(`Renamed: ${result.entry.name} → ${result.newName}`)

      // Rename Claude projects folder if requested
      if (result.renameClaudeProjects) {
        const homeDir = os.homedir()
        const oldClaudePath = `${homeDir}/.claude/projects${sourcePath.replace(/\//g, "-")}`
        const newClaudePath = `${homeDir}/.claude/projects${targetPath.replace(/\//g, "-")}`

        if (fs.existsSync(oldClaudePath)) {
          fs.renameSync(oldClaudePath, newClaudePath)
          console.error(`Renamed Claude projects folder`)
        }
      }

      // If user was in the renamed directory, cd to new path
      if (cwd === sourcePath || cwd.startsWith(sourcePath + "/")) {
        const newCwd = cwd.replace(sourcePath, targetPath)
        console.log(generateCdCommand(newCwd))
      }
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

  console.error(`Cloning ${url}...`)
  const result = await cloneRepo(config, { url })

  if (!result.success) {
    console.error(`Clone failed: ${result.error}`)
    process.exit(1)
  }

  await executeCallback(config, "after_clone", result.path)
  const runStartup = config.startup_command && (await confirmStartup(config.startup_command))
  console.log(generateCdCommand(result.path, runStartup ? config.startup_command : undefined))
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
    const runStartup = config.startup_command && (await confirmStartup(config.startup_command))
    console.log(generateCdCommand(result.path, runStartup ? config.startup_command : undefined))
  } else {
    // Not a git repo, just create a regular directory
    const fullPath = createTryDir(config, name)
    await runInitActions(config, fullPath)
    await executeCallback(config, "after_create", fullPath)
    const runStartup = config.startup_command && (await confirmStartup(config.startup_command))
    console.log(generateCdCommand(fullPath, runStartup ? config.startup_command : undefined))
  }
}

/**
 * Show configuration
 */
function showConfig(): void {
  console.log(JSON.stringify(config, null, 2))
}

/**
 * List try directories
 * @param count - Number of entries to show (default 10)
 * @param filter - Optional string to filter entries
 */
function listTries(count: number = 10, filter?: string): void {
  const entries = loadTries(config)

  // Sort by access time, most recent first
  entries.sort((a, b) => b.accessedAt.getTime() - a.accessedAt.getTime())

  // Filter if provided
  let filtered = entries
  if (filter) {
    const lowerFilter = filter.toLowerCase()
    filtered = entries.filter((e) => e.name.toLowerCase().includes(lowerFilter))
  }

  // Limit and output full paths
  filtered.slice(0, count).forEach((e) => console.log(e.path))
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
  try -l [filter] [n]     List tries (optionally filter, show n entries)
  try init [shell]        Output shell integration script
  try config              Show configuration

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

  // Handle -l flag: list directories
  if (args.includes("-l")) {
    const lIndex = args.indexOf("-l")
    const restArgs = args.slice(lIndex + 1)

    let count = 10
    let filter: string | undefined

    for (const arg of restArgs) {
      const num = parseInt(arg, 10)
      if (!isNaN(num)) {
        count = num
      } else {
        filter = arg
      }
    }

    listTries(count, filter)
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
