import { describe, it, expect } from "bun:test";
import { extractRepoName } from "../lib/git.js";

describe("extractRepoName", () => {
  it("extracts name from HTTPS URL", () => {
    expect(extractRepoName("https://github.com/user/repo.git")).toBe("repo");
  });

  it("extracts name from HTTPS URL without .git", () => {
    expect(extractRepoName("https://github.com/user/repo")).toBe("repo");
  });

  it("extracts name from SSH URL", () => {
    expect(extractRepoName("git@github.com:user/repo.git")).toBe("repo");
  });

  it("extracts name from SSH URL without .git", () => {
    expect(extractRepoName("git@github.com:user/repo")).toBe("repo");
  });

  it("handles nested paths", () => {
    expect(extractRepoName("https://gitlab.com/group/subgroup/repo.git")).toBe(
      "repo"
    );
  });

  it("handles simple name input", () => {
    expect(extractRepoName("repo")).toBe("repo");
  });
});

// Note: cloneRepo and createWorktree are integration tests that require
// actual git operations. These would be better tested in an E2E test suite.
