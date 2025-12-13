import { describe, it, expect } from "bun:test"
import { extractRepoName } from "../lib/git.js"

describe("extractRepoName", () => {
  it("extracts user-repo from HTTPS URL", () => {
    expect(extractRepoName("https://github.com/rails/rails.git")).toBe("rails-rails")
  })

  it("extracts user-repo from HTTPS URL without .git", () => {
    expect(extractRepoName("https://github.com/tobi/try")).toBe("tobi-try")
  })

  it("extracts user-repo from SSH URL", () => {
    expect(extractRepoName("git@github.com:anthropics/claude-code.git")).toBe(
      "anthropics-claude-code"
    )
  })

  it("extracts user-repo from SSH URL without .git", () => {
    expect(extractRepoName("git@github.com:user/repo")).toBe("user-repo")
  })

  it("handles nested gitlab paths", () => {
    // For nested paths, we get the two after the host
    expect(extractRepoName("https://gitlab.com/group/subgroup/repo.git")).toBe("group-subgroup")
  })

  it("handles simple name input", () => {
    expect(extractRepoName("repo")).toBe("repo")
  })
})
