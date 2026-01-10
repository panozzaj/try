import React from "react"
import { Box, Text, useInput } from "ink"
import type { TryEntry } from "../types.js"
import { KeyboardHints } from "./KeyboardHints.js"

interface ArchiveConfirmProps {
  entry: TryEntry
  archivePath: string
  onConfirm: () => void
  onCancel: () => void
}

export function ArchiveConfirm({ entry, archivePath, onConfirm, onCancel }: ArchiveConfirmProps) {
  useInput((char, key) => {
    if (key.escape || char === "n" || char === "N") {
      onCancel()
    } else if (key.return || char === "y" || char === "Y") {
      onConfirm()
    }
  })

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="blue">
          Archive directory?
        </Text>
      </Box>

      <Box>
        <Text dimColor>From: </Text>
        <Text>{entry.path}</Text>
      </Box>

      <Box>
        <Text dimColor>To: </Text>
        <Text>
          {archivePath}/{entry.name}
        </Text>
      </Box>

      <Box marginTop={1}>
        <KeyboardHints
          hints={[
            { key: "y/enter", action: "confirm" },
            { key: "n/esc", action: "cancel" },
          ]}
        />
      </Box>
    </Box>
  )
}
