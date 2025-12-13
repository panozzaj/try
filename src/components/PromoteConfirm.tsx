import React, { useState } from "react"
import { Box, Text, useInput } from "ink"
import type { TryEntry } from "../types.js"
import { KeyboardHints } from "./KeyboardHints.js"

interface PromoteConfirmProps {
  entry: TryEntry
  defaultTarget: string
  onConfirm: (targetPath: string) => void
  onCancel: () => void
}

export function PromoteConfirm({ entry, defaultTarget, onConfirm, onCancel }: PromoteConfirmProps) {
  const [input, setInput] = useState(defaultTarget)
  const [cursorPos, setCursorPos] = useState(defaultTarget.length)

  useInput((char, key) => {
    if (key.escape) {
      onCancel()
    } else if (key.return) {
      if (input.trim()) {
        onConfirm(input.trim())
      }
    } else if (key.backspace || key.delete) {
      if (cursorPos > 0) {
        setInput((prev) => prev.slice(0, cursorPos - 1) + prev.slice(cursorPos))
        setCursorPos((prev) => prev - 1)
      }
    } else if (key.leftArrow) {
      setCursorPos((prev) => Math.max(0, prev - 1))
    } else if (key.rightArrow) {
      setCursorPos((prev) => Math.min(input.length, prev + 1))
    } else if (key.ctrl && char === "a") {
      setCursorPos(0)
    } else if (key.ctrl && char === "e") {
      setCursorPos(input.length)
    } else if (key.ctrl && char === "k") {
      setInput((prev) => prev.slice(0, cursorPos))
    } else if (key.ctrl && char === "u") {
      setInput((prev) => prev.slice(cursorPos))
      setCursorPos(0)
    } else if (char && !key.ctrl && !key.meta) {
      setInput((prev) => prev.slice(0, cursorPos) + char + prev.slice(cursorPos))
      setCursorPos((prev) => prev + 1)
    }
  })

  // Render input with cursor
  const beforeCursor = input.slice(0, cursorPos)
  const afterCursor = input.slice(cursorPos)
  const cursorChar = afterCursor[0] || " "
  const restAfterCursor = afterCursor.slice(1)

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="yellow">
          Promote directory
        </Text>
      </Box>

      <Box>
        <Text dimColor>From: </Text>
        <Text>{entry.path}</Text>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>To: </Text>
        <Text>
          {beforeCursor}
          <Text inverse>{cursorChar}</Text>
          {restAfterCursor}
        </Text>
      </Box>

      <Box marginTop={1}>
        <KeyboardHints
          hints={[
            { key: "enter", action: "confirm" },
            { key: "esc", action: "cancel" },
          ]}
        />
      </Box>
    </Box>
  )
}
