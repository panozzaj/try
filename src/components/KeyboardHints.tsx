import React from "react"
import { Box, Text, useStdout } from "ink"

interface KeyboardHint {
  key: string
  action: string
}

interface KeyboardHintsProps {
  hints: KeyboardHint[]
}

export function KeyboardHints({ hints }: KeyboardHintsProps) {
  const { stdout } = useStdout()
  const terminalWidth = stdout?.columns ?? 80

  // Calculate width of each hint: " key action " + separator "│"
  const hintWidths = hints.map((hint) => hint.key.length + hint.action.length + 4)

  // Account for border (2 chars) and paddingX (2 chars)
  const availableWidth = terminalWidth - 4

  // Group hints into rows that fit within available width
  const rows: KeyboardHint[][] = []
  let currentRow: KeyboardHint[] = []
  let currentRowWidth = 0

  hints.forEach((hint, index) => {
    const hintWidth = hintWidths[index]
    const separatorWidth = currentRow.length > 0 ? 1 : 0 // pipe separator

    if (currentRowWidth + hintWidth + separatorWidth > availableWidth && currentRow.length > 0) {
      rows.push(currentRow)
      currentRow = [hint]
      currentRowWidth = hintWidth
    } else {
      currentRow.push(hint)
      currentRowWidth += hintWidth + separatorWidth
    }
  })

  if (currentRow.length > 0) {
    rows.push(currentRow)
  }

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
      {rows.map((row, rowIndex) => (
        <Box key={rowIndex}>
          {row.map((hint, index) => (
            <React.Fragment key={hint.key}>
              <Text color="cyan"> {hint.key}</Text>
              <Text color="gray"> {hint.action} </Text>
              {index < row.length - 1 && <Text color="gray">│</Text>}
            </React.Fragment>
          ))}
        </Box>
      ))}
    </Box>
  )
}
