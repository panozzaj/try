import React from "react"
import { Box, Text, useInput } from "ink"

interface StartupConfirmProps {
  command: string
  onConfirm: () => void
  onSkip: () => void
}

export function StartupConfirm({ command, onConfirm, onSkip }: StartupConfirmProps) {
  useInput((char, key) => {
    if (key.escape || char === "n" || char === "N") {
      onSkip()
    } else if (key.return || char === "y" || char === "Y") {
      onConfirm()
    }
  })

  return (
    <Box flexDirection="column" paddingY={1}>
      <Box>
        <Text>Run </Text>
        <Text color="cyan" bold>
          {command}
        </Text>
        <Text>? </Text>
        <Text color="gray">(Y/n)</Text>
      </Box>
    </Box>
  )
}
