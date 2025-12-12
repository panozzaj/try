import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"
import { executeCallback, hasCallback, runBeforeDelete } from "../lib/callbacks.js"
import type { TryConfig } from "../types.js"

describe("callbacks", () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "try-ink-callback-test-"))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  describe("hasCallback", () => {
    it("returns true when callback exists", () => {
      const config: TryConfig = {
        path: tempDir,
        callbacks: {
          after_create: "echo test",
        },
      }
      expect(hasCallback(config, "after_create")).toBe(true)
    })

    it("returns false when callback is null", () => {
      const config: TryConfig = {
        path: tempDir,
        callbacks: {
          after_create: null,
        },
      }
      expect(hasCallback(config, "after_create")).toBe(false)
    })

    it("returns false when callback is undefined", () => {
      const config: TryConfig = {
        path: tempDir,
        callbacks: {},
      }
      expect(hasCallback(config, "after_create")).toBe(false)
    })

    it("returns false when callbacks object is undefined", () => {
      const config: TryConfig = {
        path: tempDir,
      }
      expect(hasCallback(config, "after_create")).toBe(false)
    })
  })

  describe("executeCallback", () => {
    it("returns success when no callback is configured", async () => {
      const config: TryConfig = { path: tempDir }
      const result = await executeCallback(config, "after_create", tempDir)

      expect(result.success).toBe(true)
      expect(result.exitCode).toBe(0)
    })

    it("executes inline script", async () => {
      const markerFile = path.join(tempDir, "marker")
      const config: TryConfig = {
        path: tempDir,
        callbacks: {
          after_create: `touch "${markerFile}"`,
        },
      }

      const result = await executeCallback(config, "after_create", tempDir)

      expect(result.success).toBe(true)
      expect(fs.existsSync(markerFile)).toBe(true)
    })

    it("passes directory path as $1", async () => {
      const outputFile = path.join(tempDir, "output")
      const config: TryConfig = {
        path: tempDir,
        callbacks: {
          after_create: `echo "$1" > "${outputFile}"`,
        },
      }

      await executeCallback(config, "after_create", tempDir)

      const content = fs.readFileSync(outputFile, "utf-8").trim()
      expect(content).toBe(tempDir)
    })

    it("sets TRY_DIR environment variable", async () => {
      const outputFile = path.join(tempDir, "env_output")
      const config: TryConfig = {
        path: tempDir,
        callbacks: {
          after_create: `echo "$TRY_DIR" > "${outputFile}"`,
        },
      }

      await executeCallback(config, "after_create", tempDir)

      const content = fs.readFileSync(outputFile, "utf-8").trim()
      expect(content).toBe(tempDir)
    })

    it("captures stdout", async () => {
      const config: TryConfig = {
        path: tempDir,
        callbacks: {
          after_create: 'echo "hello world"',
        },
      }

      const result = await executeCallback(config, "after_create", tempDir)

      expect(result.stdout.trim()).toBe("hello world")
    })

    it("captures stderr", async () => {
      const config: TryConfig = {
        path: tempDir,
        callbacks: {
          after_create: 'echo "error message" >&2',
        },
      }

      const result = await executeCallback(config, "after_create", tempDir)

      expect(result.stderr.trim()).toBe("error message")
    })

    it("reports failure for non-zero exit", async () => {
      const config: TryConfig = {
        path: tempDir,
        callbacks: {
          after_create: "exit 1",
        },
      }

      const result = await executeCallback(config, "after_create", tempDir)

      expect(result.success).toBe(false)
      expect(result.exitCode).toBe(1)
    })

    it("executes script file", async () => {
      const scriptPath = path.join(tempDir, "script.sh")
      const markerFile = path.join(tempDir, "script_marker")

      fs.writeFileSync(scriptPath, `#!/bin/bash\ntouch "${markerFile}"\n`, { mode: 0o755 })

      const config: TryConfig = {
        path: tempDir,
        callbacks: {
          after_create: scriptPath,
        },
      }

      const result = await executeCallback(config, "after_create", tempDir)

      expect(result.success).toBe(true)
      expect(fs.existsSync(markerFile)).toBe(true)
    })

    it("reports error for non-existent script file", async () => {
      const config: TryConfig = {
        path: tempDir,
        callbacks: {
          after_create: "/nonexistent/script.sh",
        },
      }

      const result = await executeCallback(config, "after_create", tempDir)

      expect(result.success).toBe(false)
      expect(result.stderr).toContain("not found")
    })
  })

  describe("runBeforeDelete", () => {
    it("proceeds when no callback configured", async () => {
      const config: TryConfig = { path: tempDir }
      const result = await runBeforeDelete(config, tempDir)

      expect(result.proceed).toBe(true)
    })

    it("proceeds when callback exits 0", async () => {
      const config: TryConfig = {
        path: tempDir,
        callbacks: {
          before_delete: "exit 0",
        },
      }

      const result = await runBeforeDelete(config, tempDir)

      expect(result.proceed).toBe(true)
    })

    it("aborts when callback exits non-zero", async () => {
      const config: TryConfig = {
        path: tempDir,
        callbacks: {
          before_delete: 'echo "Abort!" >&2; exit 1',
        },
      }

      const result = await runBeforeDelete(config, tempDir)

      expect(result.proceed).toBe(false)
      expect(result.message).toContain("Abort!")
    })
  })
})
