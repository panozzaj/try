import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  getConfigPaths,
  parseConfig,
  expandPath,
  loadConfig,
  ensureTriesDir,
} from "../lib/config.js";
import type { TryConfig } from "../types.js";

describe("getConfigPaths", () => {
  it("returns expected config file locations", () => {
    const paths = getConfigPaths();
    const home = os.homedir();

    expect(paths).toContain(path.join(home, ".tryrc"));
    expect(paths).toContain(path.join(home, ".tryrc.yaml"));
    expect(paths).toContain(path.join(home, ".config", "try", "config.yaml"));
  });
});

describe("expandPath", () => {
  it("expands ~ to home directory", () => {
    const expanded = expandPath("~/src/tries");
    expect(expanded).toBe(path.join(os.homedir(), "src/tries"));
  });

  it("handles paths without ~", () => {
    const expanded = expandPath("/usr/local/bin");
    expect(expanded).toBe("/usr/local/bin");
  });

  it("handles ~ without slash", () => {
    const expanded = expandPath("~foo");
    expect(expanded).toBe(path.join(os.homedir(), "foo"));
  });
});

describe("parseConfig", () => {
  it("parses valid YAML config", () => {
    const yaml = `
path: ~/src/tries
callbacks:
  after_create: git init "$1"
templates:
  laravel: laravel new "$1"
`;
    const config = parseConfig(yaml);

    expect(config.path).toBe("~/src/tries");
    expect(config.callbacks?.after_create).toBe('git init "$1"');
    expect(config.templates?.laravel).toBe('laravel new "$1"');
  });

  it("handles empty config", () => {
    const config = parseConfig("");
    expect(config).toEqual({});
  });

  it("handles invalid YAML by throwing", () => {
    expect(() => parseConfig("not: valid: yaml: [")).toThrow();
  });

  it("handles null callbacks", () => {
    const yaml = `
path: ~/src/tries
callbacks:
  after_create: null
  after_clone: ~/.config/try/hooks/after_clone
`;
    const config = parseConfig(yaml);

    expect(config.callbacks?.after_create).toBeNull();
    expect(config.callbacks?.after_clone).toBe("~/.config/try/hooks/after_clone");
  });
});

describe("loadConfig", () => {
  it("returns default config when no file exists", () => {
    const config = loadConfig();
    expect(config.path).toContain("tries");
  });
});

describe("ensureTriesDir", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "try-ink-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates directory if it does not exist", () => {
    const triesPath = path.join(tempDir, "tries");
    const config: TryConfig = { path: triesPath };

    expect(fs.existsSync(triesPath)).toBe(false);
    ensureTriesDir(config);
    expect(fs.existsSync(triesPath)).toBe(true);
  });

  it("does nothing if directory exists", () => {
    const triesPath = path.join(tempDir, "tries");
    fs.mkdirSync(triesPath);
    const config: TryConfig = { path: triesPath };

    ensureTriesDir(config);
    expect(fs.existsSync(triesPath)).toBe(true);
  });
});
