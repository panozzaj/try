import { describe, it, expect } from "bun:test";
import {
  generateShellInit,
  detectShell,
  generateCdCommand,
} from "../lib/shell.js";

describe("generateShellInit", () => {
  it("generates bash/zsh init script", () => {
    const script = generateShellInit("bash");
    expect(script).toContain("try()");
    expect(script).toContain("try-ink cd");
    expect(script).toContain("eval");
  });

  it("generates zsh init script (same as bash)", () => {
    const bashScript = generateShellInit("bash");
    const zshScript = generateShellInit("zsh");
    expect(bashScript).toBe(zshScript);
  });

  it("generates fish init script", () => {
    const script = generateShellInit("fish");
    expect(script).toContain("function try");
    expect(script).toContain("try-ink cd");
    expect(script).toContain("eval");
  });

  it("throws for unsupported shell", () => {
    expect(() => generateShellInit("powershell" as any)).toThrow(
      "Unsupported shell"
    );
  });
});

describe("detectShell", () => {
  it("returns a valid shell type", () => {
    const shell = detectShell();
    expect(["bash", "zsh", "fish"]).toContain(shell);
  });
});

describe("generateCdCommand", () => {
  it("generates cd command for simple path", () => {
    const cmd = generateCdCommand("/home/user/tries/test");
    expect(cmd).toBe("cd '/home/user/tries/test'");
  });

  it("escapes single quotes in path", () => {
    const cmd = generateCdCommand("/home/user/it's a test");
    expect(cmd).toBe("cd '/home/user/it'\\''s a test'");
  });

  it("handles paths with spaces", () => {
    const cmd = generateCdCommand("/home/user/my project");
    expect(cmd).toBe("cd '/home/user/my project'");
  });
});
