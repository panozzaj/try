import { describe, it, expect, beforeAll, afterAll } from "bun:test"
import { spawn } from "node:child_process"
import { mkdtemp, rm, mkdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const CLI_PATH = join(import.meta.dir, "../cli.tsx")

interface RunResult {
  stdout: string
  stderr: string
  exitCode: number
}

function runCli(
  args: string[],
  env: Record<string, string> = {},
  cwd?: string
): Promise<RunResult> {
  return new Promise((resolve) => {
    // Remove git-related env vars that might interfere with git operations
    // (e.g., GIT_INDEX_FILE set during git commit)
    const cleanEnv = { ...process.env }
    delete cleanEnv.GIT_INDEX_FILE
    delete cleanEnv.GIT_DIR
    delete cleanEnv.GIT_WORK_TREE
    delete cleanEnv.GIT_AUTHOR_DATE
    delete cleanEnv.GIT_COMMITTER_DATE

    const child = spawn("npx", ["tsx", CLI_PATH, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...cleanEnv, ...env },
      cwd,
    })

    let stdout = ""
    let stderr = ""

    child.stdout.on("data", (data) => {
      stdout += data.toString()
    })

    child.stderr.on("data", (data) => {
      stderr += data.toString()
    })

    child.on("close", (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 1,
      })
    })
  })
}

describe("CLI", () => {
  let testTriesDir: string

  beforeAll(async () => {
    testTriesDir = await mkdtemp(join(tmpdir(), "try-ink-test-"))
  })

  afterAll(async () => {
    await rm(testTriesDir, { recursive: true, force: true })
  })

  describe("help", () => {
    it("outputs help with -h flag", async () => {
      const result = await runCli(["-h"])
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain("try-ink")
      expect(result.stdout).toContain("Interactive selector")
    })

    it("outputs help with --help flag", async () => {
      const result = await runCli(["--help"])
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain("Usage:")
    })
  })

  describe("version", () => {
    it("outputs version with -V flag", async () => {
      const result = await runCli(["-V"])
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/^\d+\.\d+\.\d+\n$/)
    })

    it("outputs version with --version flag", async () => {
      const result = await runCli(["--version"])
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/^\d+\.\d+\.\d+\n$/)
    })
  })

  describe("init", () => {
    it("outputs bash/zsh shell init script by default", async () => {
      const result = await runCli(["init"])
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain("try()")
      expect(result.stdout).toContain("try-ink")
      expect(result.stdout).toContain("eval")
    })

    it("outputs fish shell init script", async () => {
      const result = await runCli(["init", "fish"])
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain("function try")
      expect(result.stdout).toContain("try-ink")
    })
  })

  describe("config", () => {
    it("outputs config as JSON", async () => {
      const result = await runCli(["config"])
      expect(result.exitCode).toBe(0)
      const config = JSON.parse(result.stdout)
      expect(config).toHaveProperty("path")
    })
  })

  describe("git URL detection", () => {
    // Note: URL parsing is unit tested in git.test.ts (extractRepoName)
    // These integration tests verify the CLI recognizes git URLs
    // We use file:// URLs with local repos to avoid network calls

    let localRepoPath: string

    beforeAll(async () => {
      // Create a local bare git repo for testing
      localRepoPath = join(testTriesDir, "test-repo.git")
      await mkdir(localRepoPath, { recursive: true })
      const { spawn: spawnAsync } = await import("node:child_process")
      await new Promise<void>((resolve) => {
        const child = spawnAsync("git", ["init", "--bare"], { cwd: localRepoPath })
        child.on("close", () => resolve())
      })
    })

    it("clones from file:// URL and uses repo name in directory path", async () => {
      const result = await runCli([`file://${localRepoPath}`], {
        HOME: testTriesDir,
      })
      expect(result.exitCode).toBe(0)
      // Should output cd command after successful clone
      expect(result.stdout).toContain("cd '")
      // Directory name should include date prefix and repo name
      expect(result.stdout).toMatch(/\d{4}-\d{2}-\d{2}-test-repo/)
    })
  })

  describe("worktree", () => {
    let localRepoPath: string
    let worktreeName: string
    let worktreeTestDir: string
    let triesDir: string

    beforeAll(async () => {
      // Use unique name to avoid conflicts between test runs
      worktreeName = `worktree-test-${Date.now()}`

      // Create a separate temp dir for worktree tests
      worktreeTestDir = await mkdtemp(join(tmpdir(), "try-ink-worktree-"))
      triesDir = join(worktreeTestDir, "tries")
      await mkdir(triesDir, { recursive: true })

      // Create a local git repo for worktree testing
      localRepoPath = join(worktreeTestDir, "worktree-source")
      await mkdir(localRepoPath, { recursive: true })
      const { spawn: spawnAsync } = await import("node:child_process")
      // Initialize a regular (non-bare) repo and make a commit
      await new Promise<void>((resolve) => {
        const child = spawnAsync("git", ["init"], { cwd: localRepoPath })
        child.on("close", () => resolve())
      })
      await new Promise<void>((resolve) => {
        const child = spawnAsync("git", ["config", "user.email", "test@test.com"], {
          cwd: localRepoPath,
        })
        child.on("close", () => resolve())
      })
      await new Promise<void>((resolve) => {
        const child = spawnAsync("git", ["config", "user.name", "Test"], {
          cwd: localRepoPath,
        })
        child.on("close", () => resolve())
      })
      await new Promise<void>((resolve) => {
        const child = spawnAsync("git", ["commit", "--allow-empty", "-m", "initial"], {
          cwd: localRepoPath,
        })
        child.on("close", () => resolve())
      })
    })

    afterAll(async () => {
      // Clean up worktrees before removing the repo
      const { spawn: spawnAsync } = await import("node:child_process")
      await new Promise<void>((resolve) => {
        const child = spawnAsync("git", ["worktree", "prune"], { cwd: localRepoPath })
        child.on("close", () => resolve())
      })
      // Clean up the temp directory
      await rm(worktreeTestDir, { recursive: true, force: true })
    })

    it("shows error when no name provided with try .", async () => {
      const result = await runCli(["."], {
        TRY_PATH: triesDir,
      })
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain("requires a name argument")
    })

    it(
      "creates worktree from git repo",
      async () => {
        const result = await runCli([".", worktreeName], { TRY_PATH: triesDir }, localRepoPath)
        // When run from the test repo, it should create a worktree
        expect(result.exitCode).toBe(0)
        expect(result.stdout).toContain("cd '")
        expect(result.stdout).toMatch(new RegExp(`\\d{4}-\\d{2}-\\d{2}-${worktreeName}`))
      },
      { timeout: 15000 }
    )
  })
})

describe("CLI with existing directories", () => {
  let testTriesDir: string
  let triesPath: string

  beforeAll(async () => {
    testTriesDir = await mkdtemp(join(tmpdir(), "try-ink-test-"))
    triesPath = join(testTriesDir, "tries")
    await mkdir(triesPath, { recursive: true })
    await mkdir(join(triesPath, "2025-01-15-test-project"))
    await mkdir(join(triesPath, "2025-01-14-another-project"))
  })

  afterAll(async () => {
    await rm(testTriesDir, { recursive: true, force: true })
  })

  // Note: Full interactive tests would require ink-testing-library with TTY mocking.
  // The directory existence checks are also tested in tries.test.ts at the lib level.
})
