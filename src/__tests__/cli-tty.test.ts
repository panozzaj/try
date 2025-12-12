import { describe, it, expect } from "bun:test";
import { spawn } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";

/**
 * Test that the CLI works when stdout is captured (not a TTY).
 * This simulates the shell wrapper: `output=$(try cd "$@" 2>/dev/tty)`
 *
 * The UI should render to stderr, and only the cd command goes to stdout.
 */
describe("CLI with captured stdout", () => {
  const cliPath = path.join(import.meta.dir, "../../dist/try");

  it("runs without crashing when stdout is piped", async () => {
    // Run the CLI with --help (doesn't need TTY interaction)
    const result = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
      const child = spawn(cliPath, ["--help"], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        resolve({ code: code ?? 1, stdout, stderr });
      });
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("try");
  });

  it("config command works with piped stdout", async () => {
    const result = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
      const child = spawn(cliPath, ["config"], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        resolve({ code: code ?? 1, stdout, stderr });
      });
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Configuration:");
    expect(result.stdout).toContain("Path:");
  });

  it("interactive selector renders UI to stderr when stdout is piped", async () => {
    // This test simulates the shell wrapper environment where:
    // - stdout is captured (piped) for eval
    // - UI should render to stderr
    // - stdin sends ESC to exit

    const result = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
      const child = spawn(cliPath, ["cd"], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      // Send ESC to cancel after a short delay
      setTimeout(() => {
        child.stdin.write("\x1b"); // ESC key
        child.stdin.end();
      }, 100);

      // Timeout after 2 seconds in case it hangs
      const timeout = setTimeout(() => {
        child.kill();
        resolve({ code: 1, stdout, stderr: stderr + "\nTIMEOUT" });
      }, 2000);

      child.on("close", (code) => {
        clearTimeout(timeout);
        resolve({ code: code ?? 1, stdout, stderr });
      });
    });

    // UI elements should appear in stderr (Search prompt, navigation hints)
    expect(result.stderr).toContain("Search");
    expect(result.stderr).toContain("navigate");

    // stdout should be empty or just the cd command (not UI)
    expect(result.stdout).not.toContain("Search");
  });
});
