import { describe, it, expect, mock } from "bun:test"
import React from "react"
import { render } from "ink-testing-library"
import { DeleteConfirm } from "../components/DeleteConfirm.js"
import type { TryEntry } from "../types.js"

// Terminal key codes for stdin.write()
const keys = {
  escape: "\x1B",
  enter: "\r",
  backspace: "\x7F",
  tab: "\t",
  up: "\x1B[A",
  down: "\x1B[B",
  left: "\x1B[D",
  right: "\x1B[C",
} as const

const createEntry = (name: string): TryEntry => ({
  path: `/home/user/tries/${name}`,
  name,
  createdAt: new Date(),
  accessedAt: new Date(),
  modifiedAt: new Date(),
  baseName: name.replace(/^\d{4}-\d{2}-\d{2}-/, ""),
})

// Helper to wait for ink to initialize and process input
const wait = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms))

describe("DeleteConfirm", () => {
  it("renders directory name and path", () => {
    const entry = createEntry("2025-12-12-test-project")
    const onConfirm = mock(() => {})
    const onCancel = mock(() => {})

    const { lastFrame } = render(
      <DeleteConfirm entry={entry} onConfirm={onConfirm} onCancel={onCancel} />
    )

    const output = lastFrame()
    expect(output).toContain("Delete directory?")
    expect(output).toContain("2025-12-12-test-project")
    expect(output).toContain("/home/user/tries/2025-12-12-test-project")
  })

  it("calls onCancel when escape is pressed", async () => {
    const entry = createEntry("2025-12-12-test")
    const onConfirm = mock(() => {})
    const onCancel = mock(() => {})

    const { stdin } = render(
      <DeleteConfirm entry={entry} onConfirm={onConfirm} onCancel={onCancel} />
    )

    await wait(100)

    stdin.write(keys.escape)
    await wait()

    expect(onCancel).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it("does not confirm when enter pressed with wrong input", async () => {
    const entry = createEntry("2025-12-12-test")
    const onConfirm = mock(() => {})
    const onCancel = mock(() => {})

    const { stdin } = render(
      <DeleteConfirm entry={entry} onConfirm={onConfirm} onCancel={onCancel} />
    )

    await wait(100)

    stdin.write("wrong-name")
    await wait()
    stdin.write(keys.enter)
    await wait()

    expect(onConfirm).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it("confirms when enter pressed with correct input", async () => {
    const entry = createEntry("2025-12-12-test")
    const onConfirm = mock(() => {})
    const onCancel = mock(() => {})

    const { stdin } = render(
      <DeleteConfirm entry={entry} onConfirm={onConfirm} onCancel={onCancel} />
    )

    await wait(100)

    stdin.write("2025-12-12-test")
    await wait()
    stdin.write(keys.enter)
    await wait()

    expect(onConfirm).toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it("shows input as user types", async () => {
    const entry = createEntry("2025-12-12-test")
    const onConfirm = mock(() => {})
    const onCancel = mock(() => {})

    const { stdin, lastFrame } = render(
      <DeleteConfirm entry={entry} onConfirm={onConfirm} onCancel={onCancel} />
    )

    await wait(100)

    stdin.write("202")
    await wait()

    expect(lastFrame()).toContain("202")
  })

  it("handles backspace", async () => {
    const entry = createEntry("2025-12-12-test")
    const onConfirm = mock(() => {})
    const onCancel = mock(() => {})

    const { stdin, lastFrame } = render(
      <DeleteConfirm entry={entry} onConfirm={onConfirm} onCancel={onCancel} />
    )

    await wait(100)

    stdin.write("abc")
    await wait()
    expect(lastFrame()).toContain("abc")

    stdin.write(keys.backspace)
    await wait()

    const frame = lastFrame()!
    expect(frame).toContain("ab")
    expect(frame).not.toMatch(/abc[^█]/) // abc shouldn't appear except as prefix of "ab"
  })

  it("shows green text when input matches directory name", async () => {
    const entry = createEntry("2025-12-12-test")
    const onConfirm = mock(() => {})
    const onCancel = mock(() => {})

    const { stdin, lastFrame } = render(
      <DeleteConfirm entry={entry} onConfirm={onConfirm} onCancel={onCancel} />
    )

    await wait(100)

    // Initially shows hint to cancel
    expect(lastFrame()).toContain("esc to cancel")

    // Type the correct name
    stdin.write("2025-12-12-test")
    await wait()

    // Should now show hint to press enter
    expect(lastFrame()).toContain("Press enter to delete")
  })
})
