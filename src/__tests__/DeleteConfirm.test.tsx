import { describe, it, expect, mock } from "bun:test"
import React from "react"
import { render } from "ink-testing-library"
import { DeleteConfirm } from "../components/DeleteConfirm.js"
import type { TryEntry } from "../types.js"

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

    // Wait for ink to initialize
    await wait(100)

    // Send escape key
    stdin.write("\x1B")
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

    // Type wrong name and press enter
    stdin.write("wrong-name")
    await wait()
    stdin.write("\r")
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

    // Type correct name
    stdin.write("2025-12-12-test")
    await wait()

    // Press enter
    stdin.write("\r")
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

    // Send backspace (DEL character)
    stdin.write("\x7F")
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
