import React, { useState } from "react"
import { Box, Text, useInput } from "ink"
import type { TryEntry } from "../types.js"
import { KeyboardHints } from "./KeyboardHints.js"

type Phase = "path" | "claude-confirm"

interface PromoteConfirmProps {
  entry: TryEntry
  defaultTarget: string
  hasClaudeProjects: boolean
  onConfirm: (targetPath: string, renameClaudeProjects: boolean) => void
  onCancel: () => void
}

export function PromoteConfirm({
  entry,
  defaultTarget,
  hasClaudeProjects,
  onConfirm,
  onCancel,
}: PromoteConfirmProps) {
  const [input, setInput] = useState(defaultTarget)
  const [cursorPos, setCursorPos] = useState(defaultTarget.length)
  const [phase, setPhase] = useState<Phase>("path")
  const [pendingTargetPath, setPendingTargetPath] = useState("")

  useInput((char, key) => {
    if (phase === "path") {
      if (key.escape) {
        onCancel()
      } else if (key.return) {
        if (input.trim()) {
          if (hasClaudeProjects) {
            setPendingTargetPath(input.trim())
            setPhase("claude-confirm")
          } else {
            onConfirm(input.trim(), false)
          }
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
    } else if (phase === "claude-confirm") {
      if (key.escape || char === "n" || char === "N") {
        onConfirm(pendingTargetPath, false)
      } else if (key.return || char === "y" || char === "Y") {
        onConfirm(pendingTargetPath, true)
      }
    }
  })

  if (phase === "claude-confirm") {
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

        <Box>
          <Text dimColor>To: </Text>
          <Text color="green">{pendingTargetPath}</Text>
        </Box>

        <Box marginTop={1}>
          <Text>Also rename Claude Code projects folder? </Text>
          <Text color="cyan">(Y/n)</Text>
        </Box>
      </Box>
    )
  }

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
