import { describe, it, expect, mock } from "bun:test"
import React from "react"
import { render } from "ink-testing-library"
import { InitActions } from "../components/InitActions.js"
import type { InitAction } from "../types.js"

// Terminal key codes for stdin.write()
const keys = {
  escape: "\x1B",
  enter: "\r",
  space: " ",
  up: "\x1B[A",
  down: "\x1B[B",
} as const

// Helper to wait for ink to initialize and process input
const wait = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms))

describe("InitActions", () => {
  const sampleActions: Record<string, InitAction> = {
    git: { label: "git init", command: 'git init "$1"' },
    jj: { label: "jj git init --colocate", command: 'jj git init --colocate "$1"' },
  }

  it("renders all action labels", () => {
    const onConfirm = mock(() => {})
    const onSkip = mock(() => {})

    const { lastFrame } = render(
      <InitActions actions={sampleActions} onConfirm={onConfirm} onSkip={onSkip} />
    )

    const output = lastFrame()
    expect(output).toContain("Run init actions?")
    expect(output).toContain("git init")
    expect(output).toContain("jj git init --colocate")
  })

  it("starts with no selections when no defaults", () => {
    const onConfirm = mock(() => {})
    const onSkip = mock(() => {})

    const { lastFrame } = render(
      <InitActions actions={sampleActions} onConfirm={onConfirm} onSkip={onSkip} />
    )

    const output = lastFrame()!
    // Should have unchecked boxes
    expect(output).toContain("[ ]")
    // Should not have checked boxes
    expect(output).not.toContain("[x]")
  })

  it("pre-selects actions marked as default", () => {
    const actionsWithDefaults: Record<string, InitAction> = {
      git: { label: "git init", command: 'git init "$1"', default: true },
      jj: { label: "jj git init --colocate", command: 'jj git init --colocate "$1"' },
      npm: { label: "npm init -y", command: "npm init -y", default: true },
    }

    const onConfirm = mock(() => {})
    const onSkip = mock(() => {})

    const { lastFrame } = render(
      <InitActions actions={actionsWithDefaults} onConfirm={onConfirm} onSkip={onSkip} />
    )

    const output = lastFrame()!
    // Count checked and unchecked boxes
    const checkedCount = (output.match(/\[x\]/g) || []).length
    const uncheckedCount = (output.match(/\[ \]/g) || []).length

    expect(checkedCount).toBe(2) // git and npm are default
    expect(uncheckedCount).toBe(1) // jj is not default
  })

  it("pre-selects all actions when all are default", () => {
    const allDefaultActions: Record<string, InitAction> = {
      git: { label: "git init", command: 'git init "$1"', default: true },
      jj: { label: "jj git init", command: 'jj git init "$1"', default: true },
    }

    const onConfirm = mock(() => {})
    const onSkip = mock(() => {})

    const { lastFrame } = render(
      <InitActions actions={allDefaultActions} onConfirm={onConfirm} onSkip={onSkip} />
    )

    const output = lastFrame()!
    const checkedCount = (output.match(/\[x\]/g) || []).length
    const uncheckedCount = (output.match(/\[ \]/g) || []).length

    expect(checkedCount).toBe(2)
    expect(uncheckedCount).toBe(0)
  })

  it("confirms with default selections on enter", async () => {
    const actionsWithDefaults: Record<string, InitAction> = {
      git: { label: "git init", command: 'git init "$1"', default: true },
      jj: { label: "jj git init", command: 'jj git init "$1"' },
    }

    const onConfirm = mock(() => {})
    const onSkip = mock(() => {})

    const { stdin } = render(
      <InitActions actions={actionsWithDefaults} onConfirm={onConfirm} onSkip={onSkip} />
    )

    await wait(100)
    stdin.write(keys.enter)
    await wait()

    expect(onConfirm).toHaveBeenCalledWith(["git"])
    expect(onSkip).not.toHaveBeenCalled()
  })

  it("calls onSkip when escape is pressed", async () => {
    const onConfirm = mock(() => {})
    const onSkip = mock(() => {})

    const { stdin } = render(
      <InitActions actions={sampleActions} onConfirm={onConfirm} onSkip={onSkip} />
    )

    await wait(100)
    stdin.write(keys.escape)
    await wait()

    expect(onSkip).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it("calls onSkip when s is pressed", async () => {
    const onConfirm = mock(() => {})
    const onSkip = mock(() => {})

    const { stdin } = render(
      <InitActions actions={sampleActions} onConfirm={onConfirm} onSkip={onSkip} />
    )

    await wait(100)
    stdin.write("s")
    await wait()

    expect(onSkip).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it("toggles selection with space", async () => {
    const onConfirm = mock(() => {})
    const onSkip = mock(() => {})

    const { stdin, lastFrame } = render(
      <InitActions actions={sampleActions} onConfirm={onConfirm} onSkip={onSkip} />
    )

    await wait(100)

    // Initially unchecked
    expect(lastFrame()).not.toContain("[x]")

    // Toggle first item
    stdin.write(keys.space)
    await wait()

    // Should now have one checked
    expect(lastFrame()).toContain("[x]")
  })

  it("can toggle off a default selection", async () => {
    const actionsWithDefaults: Record<string, InitAction> = {
      git: { label: "git init", command: 'git init "$1"', default: true },
    }

    const onConfirm = mock(() => {})
    const onSkip = mock(() => {})

    const { stdin, lastFrame } = render(
      <InitActions actions={actionsWithDefaults} onConfirm={onConfirm} onSkip={onSkip} />
    )

    await wait(100)

    // Initially checked (default)
    expect(lastFrame()).toContain("[x]")

    // Toggle off
    stdin.write(keys.space)
    await wait()

    // Should now be unchecked
    expect(lastFrame()).toContain("[ ]")
    expect(lastFrame()).not.toContain("[x]")
  })

  it("selects all with a key", async () => {
    const onConfirm = mock(() => {})
    const onSkip = mock(() => {})

    const { stdin, lastFrame } = render(
      <InitActions actions={sampleActions} onConfirm={onConfirm} onSkip={onSkip} />
    )

    await wait(100)

    // Initially none selected
    expect(lastFrame()).not.toContain("[x]")

    // Select all
    stdin.write("a")
    await wait()

    const output = lastFrame()!
    const checkedCount = (output.match(/\[x\]/g) || []).length
    expect(checkedCount).toBe(2)
  })

  it("deselects all with a key when all selected", async () => {
    const allDefaultActions: Record<string, InitAction> = {
      git: { label: "git init", command: 'git init "$1"', default: true },
      jj: { label: "jj git init", command: 'jj git init "$1"', default: true },
    }

    const onConfirm = mock(() => {})
    const onSkip = mock(() => {})

    const { stdin, lastFrame } = render(
      <InitActions actions={allDefaultActions} onConfirm={onConfirm} onSkip={onSkip} />
    )

    await wait(100)

    // Initially all selected (defaults)
    let output = lastFrame()!
    expect((output.match(/\[x\]/g) || []).length).toBe(2)

    // Toggle all (deselect)
    stdin.write("a")
    await wait()

    output = lastFrame()!
    expect(output).not.toContain("[x]")
  })

  it("navigates with arrow keys", async () => {
    const onConfirm = mock(() => {})
    const onSkip = mock(() => {})

    const { stdin } = render(
      <InitActions actions={sampleActions} onConfirm={onConfirm} onSkip={onSkip} />
    )

    await wait(100)

    // Select first item
    stdin.write(keys.space)
    await wait()

    // Move down and select second item
    stdin.write(keys.down)
    await wait()
    stdin.write(keys.space)
    await wait()

    // Confirm
    stdin.write(keys.enter)
    await wait()

    expect(onConfirm).toHaveBeenCalledWith(["git", "jj"])
  })

  it("navigates with j/k keys", async () => {
    const onConfirm = mock(() => {})
    const onSkip = mock(() => {})

    const { stdin } = render(
      <InitActions actions={sampleActions} onConfirm={onConfirm} onSkip={onSkip} />
    )

    await wait(100)

    // Move down with j and select
    stdin.write("j")
    await wait()
    stdin.write(keys.space)
    await wait()

    // Confirm - should only have second item
    stdin.write(keys.enter)
    await wait()

    expect(onConfirm).toHaveBeenCalledWith(["jj"])
  })
})
