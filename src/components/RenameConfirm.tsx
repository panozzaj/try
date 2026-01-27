import React, { useState } from "react"
import { Box, Text, useInput } from "ink"
import type { TryEntry } from "../types.js"
import { KeyboardHints } from "./KeyboardHints.js"

type Phase = "name" | "claude-confirm"

interface RenameConfirmProps {
  entry: TryEntry
  hasClaudeProjects: boolean
  onConfirm: (newName: string, renameClaudeProjects: boolean) => void
  onCancel: () => void
}

export function RenameConfirm({
  entry,
  hasClaudeProjects,
  onConfirm,
  onCancel,
}: RenameConfirmProps) {
  const [input, setInput] = useState(entry.name)
  const [cursorPos, setCursorPos] = useState(entry.name.length)
  const [phase, setPhase] = useState<Phase>("name")
  const [pendingNewName, setPendingNewName] = useState("")

  useInput((char, key) => {
    if (phase === "name") {
      if (key.escape) {
        onCancel()
      } else if (key.return) {
        if (input.trim() && input.trim() !== entry.name) {
          if (hasClaudeProjects) {
            setPendingNewName(input.trim())
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
        onConfirm(pendingNewName, false)
      } else if (key.return || char === "y" || char === "Y") {
        onConfirm(pendingNewName, true)
      }
    }
  })

  if (phase === "claude-confirm") {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold color="yellow">
            Rename directory
          </Text>
        </Box>

        <Box>
          <Text dimColor>Renaming: </Text>
          <Text>{entry.name}</Text>
          <Text dimColor> → </Text>
          <Text color="green">{pendingNewName}</Text>
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

  const canConfirm = input.trim() && input.trim() !== entry.name

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="yellow">
          Rename directory
        </Text>
      </Box>

      <Box>
        <Text dimColor>Current: </Text>
        <Text>{entry.name}</Text>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>New name: </Text>
        <Text>
          {beforeCursor}
          <Text inverse>{cursorChar}</Text>
          {restAfterCursor}
        </Text>
      </Box>

      {!canConfirm && input.trim() === entry.name && (
        <Box marginTop={1}>
          <Text color="gray">(name unchanged)</Text>
        </Box>
      )}

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
