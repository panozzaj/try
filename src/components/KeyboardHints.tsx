import React from "react"
import { Box, Text } from "ink"

interface KeyboardHint {
  key: string
  action: string
}

interface KeyboardHintsProps {
  hints: KeyboardHint[]
}

export function KeyboardHints({ hints }: KeyboardHintsProps) {
  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1}>
      {hints.map((hint, index) => (
        <React.Fragment key={hint.key}>
          <Text color="cyan">{hint.key}</Text>
          <Text color="gray"> {hint.action}</Text>
          {index < hints.length - 1 && <Text color="gray"> </Text>}
        </React.Fragment>
      ))}
    </Box>
  )
}
