import React, { useState } from "react"
import { Box, Text, useInput } from "ink"
import type { InitAction } from "../types.js"
import { KeyboardHints } from "./KeyboardHints.js"

interface InitActionsProps {
  actions: Record<string, InitAction>
  onConfirm: (selectedKeys: string[]) => void
  onSkip: () => void
}

export function InitActions({ actions, onConfirm, onSkip }: InitActionsProps) {
  const actionKeys = Object.keys(actions)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [cursorIndex, setCursorIndex] = useState(0)

  useInput((input, key) => {
    // Navigation
    if (key.downArrow || input === "j") {
      setCursorIndex((prev) => Math.min(prev + 1, actionKeys.length - 1))
    } else if (key.upArrow || input === "k") {
      setCursorIndex((prev) => Math.max(prev - 1, 0))
    }
    // Toggle selection with space
    else if (input === " ") {
      const currentKey = actionKeys[cursorIndex]
      setSelectedKeys((prev) => {
        const next = new Set(prev)
        if (next.has(currentKey)) {
          next.delete(currentKey)
        } else {
          next.add(currentKey)
        }
        return next
      })
    }
    // Confirm with enter
    else if (key.return) {
      onConfirm(Array.from(selectedKeys))
    }
    // Skip with escape or 's'
    else if (key.escape || input === "s") {
      onSkip()
    }
    // Select all with 'a'
    else if (input === "a") {
      if (selectedKeys.size === actionKeys.length) {
        setSelectedKeys(new Set())
      } else {
        setSelectedKeys(new Set(actionKeys))
      }
    }
  })

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>Run init actions?</Text>
      </Box>

      {actionKeys.map((key, index) => {
        const action = actions[key]
        const isSelected = selectedKeys.has(key)
        const isCursor = index === cursorIndex

        return (
          <Box key={key} paddingLeft={1}>
            <Text color={isCursor ? "cyan" : undefined}>{isCursor ? ">" : " "}</Text>
            <Text color={isSelected ? "green" : "gray"}>{isSelected ? " [x] " : " [ ] "}</Text>
            <Text color={isCursor ? "cyan" : undefined}>{action.label}</Text>
          </Box>
        )
      })}

      <Box marginTop={1}>
        <KeyboardHints
          hints={[
            { key: "space", action: "toggle" },
            { key: "a", action: "all" },
            { key: "enter", action: "run" },
            { key: "s/esc", action: "skip" },
          ]}
        />
      </Box>
    </Box>
  )
}
