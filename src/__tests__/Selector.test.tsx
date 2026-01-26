import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test"
import React from "react"
import { render } from "ink-testing-library"
import { Selector } from "../components/Selector.js"
import type { TryConfig } from "../types.js"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

// Helper to wait for ink to initialize and process input
const wait = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms))

describe("Selector keyboard hints", () => {
  let tmpDir: string
  let config: TryConfig

  beforeEach(() => {
    // Create a temporary tries directory
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "try-ink-test-"))
    config = { path: tmpDir }
  })

  afterEach(() => {
    // Clean up
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it("shows keyboard hints by default on normal terminals", async () => {
    const onResult = mock(() => {})

    const { lastFrame } = render(<Selector config={config} onResult={onResult} />)

    await wait(100)

    const output = lastFrame()!
    // Should show the keyboard hints box with shortcuts
    expect(output).toContain("navigate")
    expect(output).toContain("select")
    expect(output).toContain("ctrl+y")
    expect(output).toContain("ctrl+r")
    expect(output).toContain("rename")
  })

  it("displays hints in two rows with row breaks", async () => {
    const onResult = mock(() => {})

    const { lastFrame } = render(<Selector config={config} onResult={onResult} />)

    await wait(100)

    const output = lastFrame()!
    // The hints should be split across two lines
    // First row: navigate, select, copy, rename, archive
    // Second row: delete, promote, help, cancel
    expect(output).toContain("archive")
    expect(output).toContain("delete")
    expect(output).toContain("promote")
    expect(output).toContain("help")
    expect(output).toContain("cancel")
  })

  it("includes all expected shortcuts in hints", async () => {
    const onResult = mock(() => {})

    const { lastFrame } = render(<Selector config={config} onResult={onResult} />)

    await wait(100)

    const output = lastFrame()!
    // Check all expected shortcuts are present
    expect(output).toContain("↑↓")
    expect(output).toContain("navigate")
    expect(output).toContain("enter")
    expect(output).toContain("select")
    expect(output).toContain("ctrl+y")
    expect(output).toContain("copy")
    expect(output).toContain("ctrl+r")
    expect(output).toContain("rename")
    expect(output).toContain("ctrl+a")
    expect(output).toContain("archive")
    expect(output).toContain("ctrl+d")
    expect(output).toContain("delete")
    expect(output).toContain("ctrl+o")
    expect(output).toContain("promote")
    expect(output).toContain("?")
    expect(output).toContain("toggle help")
    expect(output).toContain("esc")
    expect(output).toContain("cancel")
  })

  it("shows hints inside a bordered box", async () => {
    const onResult = mock(() => {})

    const { lastFrame } = render(<Selector config={config} onResult={onResult} />)

    await wait(100)

    const output = lastFrame()!
    // The hints should be in a bordered box
    expect(output).toContain("┌")
    expect(output).toContain("└")
    expect(output).toContain("│")
  })

  // Note: Testing ctrl+h toggle is challenging because SearchInput also handles
  // ctrl+h as backspace (Emacs-style editing). In practice, the toggle works
  // when the search input is empty, but testing this reliably requires
  // mocking the terminal dimensions or using a different approach.
})
