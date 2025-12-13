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
    const child = spawn("npx", ["tsx", CLI_PATH, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...env },
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

    beforeAll(async () => {
      // Create a local git repo for worktree testing
      localRepoPath = join(testTriesDir, "worktree-source")
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
    })

    it("shows error when no name provided with try .", async () => {
      const result = await runCli(["."], {
        HOME: testTriesDir,
      })
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain("requires a name argument")
    })

    it("creates worktree from git repo", async () => {
      const result = await runCli([".", "my-worktree"], { HOME: testTriesDir }, localRepoPath)
      // When run from the test repo, it should create a worktree
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain("cd '")
      expect(result.stdout).toMatch(/\d{4}-\d{2}-\d{2}-my-worktree/)
    })
  })
})

describe("CLI with existing directories", () => {
  let testTriesDir: string

  beforeAll(async () => {
    testTriesDir = await mkdtemp(join(tmpdir(), "try-ink-test-"))
    // Create some test directories
    await mkdir(join(testTriesDir, "src", "tries"), { recursive: true })
    await mkdir(join(testTriesDir, "src", "tries", "2025-01-15-test-project"))
    await mkdir(join(testTriesDir, "src", "tries", "2025-01-14-another-project"))
    await mkdir(join(testTriesDir, "src", "tries", "2024-12-01-old-project"))
  })

  afterAll(async () => {
    await rm(testTriesDir, { recursive: true, force: true })
  })

  // Interactive tests would go here using ink-testing-library
  // but those require more complex setup with TTY mocking
})
