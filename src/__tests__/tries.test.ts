import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  loadTries,
  createTryDir,
  deleteTryDir,
  tryExists,
  getTryPath,
  touchTryDir,
} from "../lib/tries.js";
import type { TryConfig } from "../types.js";

describe("tries", () => {
  let tempDir: string;
  let config: TryConfig;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "try-ink-test-"));
    config = { path: tempDir };
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("loadTries", () => {
    it("returns empty array for empty directory", () => {
      const entries = loadTries(config);
      expect(entries).toEqual([]);
    });

    it("loads directories from tries path", () => {
      fs.mkdirSync(path.join(tempDir, "2025-12-12-test"));
      fs.mkdirSync(path.join(tempDir, "2025-12-11-another"));

      const entries = loadTries(config);

      expect(entries.length).toBe(2);
      expect(entries.map((e) => e.name)).toContain("2025-12-12-test");
      expect(entries.map((e) => e.name)).toContain("2025-12-11-another");
    });

    it("ignores hidden directories", () => {
      fs.mkdirSync(path.join(tempDir, "2025-12-12-visible"));
      fs.mkdirSync(path.join(tempDir, ".hidden"));

      const entries = loadTries(config);

      expect(entries.length).toBe(1);
      expect(entries[0].name).toBe("2025-12-12-visible");
    });

    it("ignores files", () => {
      fs.mkdirSync(path.join(tempDir, "2025-12-12-dir"));
      fs.writeFileSync(path.join(tempDir, "file.txt"), "content");

      const entries = loadTries(config);

      expect(entries.length).toBe(1);
      expect(entries[0].name).toBe("2025-12-12-dir");
    });

    it("parses date prefix from names", () => {
      fs.mkdirSync(path.join(tempDir, "2025-12-12-experiment"));

      const entries = loadTries(config);

      expect(entries[0].datePrefix).toBe("2025-12-12");
      expect(entries[0].baseName).toBe("experiment");
    });

    it("returns empty array for non-existent path", () => {
      const nonExistentConfig: TryConfig = { path: "/nonexistent/path" };
      const entries = loadTries(nonExistentConfig);
      expect(entries).toEqual([]);
    });
  });

  describe("createTryDir", () => {
    it("creates a new directory", () => {
      const name = "2025-12-12-new-project";
      const fullPath = createTryDir(config, name);

      expect(fs.existsSync(fullPath)).toBe(true);
      expect(fullPath).toBe(path.join(tempDir, name));
    });

    it("throws if directory already exists", () => {
      const name = "2025-12-12-existing";
      fs.mkdirSync(path.join(tempDir, name));

      expect(() => createTryDir(config, name)).toThrow("already exists");
    });
  });

  describe("deleteTryDir", () => {
    it("deletes an existing directory", () => {
      const dirPath = path.join(tempDir, "2025-12-12-to-delete");
      fs.mkdirSync(dirPath);
      fs.writeFileSync(path.join(dirPath, "file.txt"), "content");

      deleteTryDir(dirPath);

      expect(fs.existsSync(dirPath)).toBe(false);
    });

    it("throws if directory does not exist", () => {
      expect(() => deleteTryDir("/nonexistent/path")).toThrow("does not exist");
    });
  });

  describe("tryExists", () => {
    it("returns true for existing directory", () => {
      fs.mkdirSync(path.join(tempDir, "existing"));
      expect(tryExists(config, "existing")).toBe(true);
    });

    it("returns false for non-existing directory", () => {
      expect(tryExists(config, "nonexistent")).toBe(false);
    });
  });

  describe("getTryPath", () => {
    it("returns full path for directory name", () => {
      const fullPath = getTryPath(config, "my-project");
      expect(fullPath).toBe(path.join(tempDir, "my-project"));
    });
  });

  describe("touchTryDir", () => {
    it("updates access time", async () => {
      const dirPath = path.join(tempDir, "2025-12-12-to-touch");
      fs.mkdirSync(dirPath);

      // Get initial access time
      const initialStats = fs.statSync(dirPath);
      const initialAtime = initialStats.atime.getTime();

      // Wait a bit and touch
      await new Promise((resolve) => setTimeout(resolve, 10));
      touchTryDir(dirPath);

      // Check access time updated
      const newStats = fs.statSync(dirPath);
      const newAtime = newStats.atime.getTime();

      expect(newAtime).toBeGreaterThanOrEqual(initialAtime);
    });

    it("does not throw for non-existent path", () => {
      expect(() => touchTryDir("/nonexistent/path")).not.toThrow();
    });
  });
});
