import React, { useState } from "react"
import { Box, Text, useInput } from "ink"
import type { TryEntry } from "../types.js"

interface DeleteConfirmProps {
  entry: TryEntry
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteConfirm({ entry, onConfirm, onCancel }: DeleteConfirmProps) {
  const [input, setInput] = useState("")

  useInput((char, key) => {
    if (key.escape) {
      onCancel()
    } else if (key.return) {
      if (input === entry.name) {
        onConfirm()
      }
    } else if (key.backspace || key.delete) {
      setInput(input.slice(0, -1))
    } else if (char && !key.ctrl && !key.meta) {
      setInput(input + char)
    }
  })

  const matches = input === entry.name

  return (
    <Box flexDirection="column" paddingY={1}>
      <Box>
        <Text color="red" bold>
          Delete directory?
        </Text>
      </Box>
      <Box paddingLeft={2} paddingY={1}>
        <Text>{entry.name}</Text>
      </Box>
      <Box paddingLeft={2}>
        <Text color="gray">{entry.path}</Text>
      </Box>
      <Box marginTop={1}>
        <Text>Type directory name to confirm: </Text>
      </Box>
      <Box paddingLeft={2}>
        <Text color={matches ? "green" : "yellow"}>{input}</Text>
        <Text color="cyan">█</Text>
      </Box>
      <Box marginTop={1}>
        <Text color="gray">{matches ? "Press enter to delete" : "esc to cancel"}</Text>
      </Box>
    </Box>
  )
}
