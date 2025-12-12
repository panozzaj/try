import React, { useState } from "react"
import { Box, Text, useInput } from "ink"
import type { TryEntry } from "../types.js"

interface DeleteConfirmProps {
  entry: TryEntry
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteConfirm({ entry, onConfirm, onCancel }: DeleteConfirmProps) {
  const [selected, setSelected] = useState<"cancel" | "delete">("cancel")

  useInput((input, key) => {
    if (key.escape || input === "n" || input === "N") {
      onCancel()
    } else if (input === "y" || input === "Y") {
      onConfirm()
    } else if (key.leftArrow || key.rightArrow || input === "h" || input === "l") {
      setSelected((prev) => (prev === "cancel" ? "delete" : "cancel"))
    } else if (key.return) {
      if (selected === "delete") {
        onConfirm()
      } else {
        onCancel()
      }
    }
  })

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
      <Box marginTop={1} gap={2}>
        <Box>
          <Text color={selected === "cancel" ? "cyan" : "gray"} bold={selected === "cancel"}>
            {selected === "cancel" ? "[Cancel]" : " Cancel "}
          </Text>
        </Box>
        <Box>
          <Text color={selected === "delete" ? "red" : "gray"} bold={selected === "delete"}>
            {selected === "delete" ? "[Delete]" : " Delete "}
          </Text>
        </Box>
      </Box>
      <Box marginTop={1}>
        <Text color="gray">y/n or ←→ to select, enter to confirm</Text>
      </Box>
    </Box>
  )
}
