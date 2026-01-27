import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import {
  validateSessionFile,
  renameClaudeProjectsFolder,
  getClaudeProjectsPath,
} from "../lib/claude-projects.js"

describe("claude-projects", () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-projects-test-"))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  describe("getClaudeProjectsPath", () => {
    it("converts path slashes to dashes", () => {
      const result = getClaudeProjectsPath("/Users/test/projects/my-app")
      expect(result).toContain("-Users-test-projects-my-app")
    })
  })

  describe("validateSessionFile", () => {
    it("validates empty file as valid", () => {
      const filePath = path.join(tmpDir, "empty.jsonl")
      fs.writeFileSync(filePath, "")
      expect(validateSessionFile(filePath)).toEqual({ valid: true })
    })

    it("validates valid session file", () => {
      const filePath = path.join(tmpDir, "valid.jsonl")
      const content = [
        '{"type":"user","uuid":"abc-123","timestamp":"2025-01-01T00:00:00Z","cwd":"/test/path"}',
        '{"type":"assistant","uuid":"def-456","timestamp":"2025-01-01T00:00:01Z","cwd":"/test/path"}',
      ].join("\n")
      fs.writeFileSync(filePath, content)

      expect(validateSessionFile(filePath)).toEqual({ valid: true })
    })

    it("rejects file with invalid JSON", () => {
      const filePath = path.join(tmpDir, "invalid.jsonl")
      fs.writeFileSync(filePath, "not json at all\n")

      const result = validateSessionFile(filePath)
      expect(result.valid).toBe(false)
      expect(result.error).toContain("Invalid JSON")
    })

    it("rejects file with non-object JSON", () => {
      const filePath = path.join(tmpDir, "array.jsonl")
      fs.writeFileSync(filePath, '["this","is","an","array"]\n')

      const result = validateSessionFile(filePath)
      expect(result.valid).toBe(false)
      expect(result.error).toContain("Expected object")
    })

    it("rejects file with non-string cwd", () => {
      const filePath = path.join(tmpDir, "bad-cwd.jsonl")
      fs.writeFileSync(
        filePath,
        '{"type":"user","uuid":"abc","timestamp":"2025-01-01","cwd":123}\n'
      )

      const result = validateSessionFile(filePath)
      expect(result.valid).toBe(false)
      expect(result.error).toContain("cwd field is not a string")
    })

    it("rejects file missing expected session fields", () => {
      const filePath = path.join(tmpDir, "missing-fields.jsonl")
      fs.writeFileSync(filePath, '{"foo":"bar","baz":123}\n')

      const result = validateSessionFile(filePath)
      expect(result.valid).toBe(false)
      expect(result.error).toContain("Missing expected session fields")
    })

    it("accepts file with snapshot type", () => {
      const filePath = path.join(tmpDir, "snapshot.jsonl")
      fs.writeFileSync(
        filePath,
        '{"type":"file-history-snapshot","snapshot":{"messageId":"abc"}}\n'
      )

      expect(validateSessionFile(filePath)).toEqual({ valid: true })
    })
  })

  describe("renameClaudeProjectsFolder", () => {
    it("returns success when source folder does not exist", () => {
      const result = renameClaudeProjectsFolder("/nonexistent/old", "/nonexistent/new")
      expect(result).toEqual({ success: true, filesModified: 0, folderRenamed: false })
    })

    it("renames folder and updates cwd in session files", () => {
      // Create mock Claude projects structure
      const oldPath = "/test/tries/2025-01-01-old-name"
      const newPath = "/test/tries/2025-01-01-new-name"
      const mockClaudeDir = path.join(tmpDir, ".claude", "projects", oldPath.replace(/\//g, "-"))
      fs.mkdirSync(mockClaudeDir, { recursive: true })

      // Create a session file with cwd
      const sessionFile = path.join(mockClaudeDir, "session-123.jsonl")
      const content = [
        `{"type":"user","uuid":"abc","timestamp":"2025-01-01","cwd":"${oldPath}","message":"test"}`,
        `{"type":"assistant","uuid":"def","timestamp":"2025-01-01","cwd":"${oldPath}","message":"reply"}`,
      ].join("\n")
      fs.writeFileSync(sessionFile, content)

      const result = renameClaudeProjectsFolder(oldPath, newPath, tmpDir)

      expect(result.success).toBe(true)
      expect(result.filesModified).toBe(1)
      expect(result.folderRenamed).toBe(true)

      // Check folder was renamed
      const newClaudeDir = path.join(tmpDir, ".claude", "projects", newPath.replace(/\//g, "-"))
      expect(fs.existsSync(newClaudeDir)).toBe(true)
      expect(fs.existsSync(mockClaudeDir)).toBe(false)

      // Check cwd was updated in file
      const newSessionFile = path.join(newClaudeDir, "session-123.jsonl")
      const updatedContent = fs.readFileSync(newSessionFile, "utf-8")
      expect(updatedContent).toContain(`"cwd":"${newPath}"`)
      expect(updatedContent).not.toContain(`"cwd":"${oldPath}"`)
    })

    it("fails if target folder already exists", () => {
      const oldPath = "/test/old"
      const newPath = "/test/new"
      const mockOldDir = path.join(tmpDir, ".claude", "projects", oldPath.replace(/\//g, "-"))
      const mockNewDir = path.join(tmpDir, ".claude", "projects", newPath.replace(/\//g, "-"))
      fs.mkdirSync(mockOldDir, { recursive: true })
      fs.mkdirSync(mockNewDir, { recursive: true })

      const result = renameClaudeProjectsFolder(oldPath, newPath, tmpDir)
      expect(result.success).toBe(false)
      expect(result.error).toContain("already exists")
    })

    it("fails if session file has unexpected structure", () => {
      const oldPath = "/test/old"
      const newPath = "/test/new"
      const mockClaudeDir = path.join(tmpDir, ".claude", "projects", oldPath.replace(/\//g, "-"))
      fs.mkdirSync(mockClaudeDir, { recursive: true })

      // Create an invalid session file
      const sessionFile = path.join(mockClaudeDir, "bad-session.jsonl")
      fs.writeFileSync(sessionFile, "not valid json\n")

      const result = renameClaudeProjectsFolder(oldPath, newPath, tmpDir)
      expect(result.success).toBe(false)
      expect(result.error).toContain("Unexpected file structure")
      expect(result.error).toContain("Invalid JSON")

      // Folder should not be renamed
      expect(fs.existsSync(mockClaudeDir)).toBe(true)
    })

    it("skips files that do not contain old path", () => {
      const oldPath = "/test/old"
      const newPath = "/test/new"
      const mockClaudeDir = path.join(tmpDir, ".claude", "projects", oldPath.replace(/\//g, "-"))
      fs.mkdirSync(mockClaudeDir, { recursive: true })

      // Create a session file with different cwd
      const sessionFile = path.join(mockClaudeDir, "other-session.jsonl")
      fs.writeFileSync(
        sessionFile,
        '{"type":"user","uuid":"abc","timestamp":"2025-01-01","cwd":"/different/path"}\n'
      )

      const result = renameClaudeProjectsFolder(oldPath, newPath, tmpDir)
      expect(result.success).toBe(true)
      expect(result.filesModified).toBe(0) // File not modified since cwd didn't match
      expect(result.folderRenamed).toBe(true)
    })
  })
})
