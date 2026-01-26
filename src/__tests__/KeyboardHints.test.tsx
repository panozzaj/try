import { describe, it, expect } from "bun:test"
import React from "react"
import { render } from "ink-testing-library"
import { KeyboardHints } from "../components/KeyboardHints.js"

describe("KeyboardHints", () => {
  it("renders all hints", () => {
    const hints = [
      { key: "enter", action: "select" },
      { key: "esc", action: "cancel" },
    ]

    const { lastFrame } = render(<KeyboardHints hints={hints} />)

    const output = lastFrame()!
    expect(output).toContain("enter")
    expect(output).toContain("select")
    expect(output).toContain("esc")
    expect(output).toContain("cancel")
  })

  it("renders hints in a bordered box", () => {
    const hints = [{ key: "enter", action: "select" }]

    const { lastFrame } = render(<KeyboardHints hints={hints} />)

    const output = lastFrame()!
    expect(output).toContain("┌")
    expect(output).toContain("└")
    expect(output).toContain("┐")
    expect(output).toContain("┘")
  })

  it("separates hints with pipe character", () => {
    const hints = [
      { key: "a", action: "first" },
      { key: "b", action: "second" },
    ]

    const { lastFrame } = render(<KeyboardHints hints={hints} />)

    const output = lastFrame()!
    expect(output).toContain("│")
  })

  it("respects explicit rowBreaks", () => {
    const hints = [
      { key: "a", action: "first" },
      { key: "b", action: "second" },
      { key: "c", action: "third" },
      { key: "d", action: "fourth" },
    ]

    const { lastFrame } = render(<KeyboardHints hints={hints} rowBreaks={[2]} />)

    const output = lastFrame()!
    // All hints should be present
    expect(output).toContain("first")
    expect(output).toContain("second")
    expect(output).toContain("third")
    expect(output).toContain("fourth")

    // The output should span multiple lines (more than just border lines)
    const lines = output.split("\n")
    // Should have: top border, row 1, row 2, bottom border
    expect(lines.length).toBeGreaterThanOrEqual(4)
  })

  it("handles single row when no rowBreaks provided", () => {
    const hints = [
      { key: "a", action: "x" },
      { key: "b", action: "y" },
    ]

    const { lastFrame } = render(<KeyboardHints hints={hints} />)

    const output = lastFrame()!
    // Both hints should be on same line (separated by pipe)
    expect(output).toContain("x")
    expect(output).toContain("y")
  })

  it("handles empty rowBreaks array", () => {
    const hints = [
      { key: "a", action: "first" },
      { key: "b", action: "second" },
    ]

    const { lastFrame } = render(<KeyboardHints hints={hints} rowBreaks={[]} />)

    const output = lastFrame()!
    expect(output).toContain("first")
    expect(output).toContain("second")
  })
})
