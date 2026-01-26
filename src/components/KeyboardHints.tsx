import React from "react"
import { Box, Text, useStdout } from "ink"

interface KeyboardHint {
  key: string
  action: string
}

interface KeyboardHintsProps {
  hints: KeyboardHint[]
  /** Explicit row breaks - indices where new rows should start */
  rowBreaks?: number[]
}

export function KeyboardHints({ hints, rowBreaks }: KeyboardHintsProps) {
  const { stdout } = useStdout()
  const terminalWidth = stdout?.columns ?? 80

  // Calculate width of each hint: " key action " + separator "│"
  const hintWidths = hints.map((hint) => hint.key.length + hint.action.length + 4)

  // Account for border (2 chars) and paddingX (2 chars)
  const availableWidth = terminalWidth - 4

  // If explicit row breaks provided, use those
  let rows: KeyboardHint[][]
  if (rowBreaks && rowBreaks.length > 0) {
    rows = []
    let startIdx = 0
    for (const breakIdx of rowBreaks) {
      rows.push(hints.slice(startIdx, breakIdx))
      startIdx = breakIdx
    }
    if (startIdx < hints.length) {
      rows.push(hints.slice(startIdx))
    }
  } else {
    // Group hints into rows that fit within available width
    rows = []
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
  }

  // Calculate row widths for alignment
  const rowWidths = rows.map((row) =>
    row.reduce((sum, hint, idx) => {
      const hintWidth = hint.key.length + hint.action.length + 4 // " key action "
      const separator = idx < row.length - 1 ? 1 : 0
      return sum + hintWidth + separator
    }, 0)
  )
  const maxRowWidth = Math.max(...rowWidths)

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
      {rows.map((row, rowIndex) => {
        const padding = maxRowWidth - rowWidths[rowIndex]
        return (
          <Box key={rowIndex}>
            {row.map((hint, index) => (
              <React.Fragment key={hint.key}>
                <Text color="cyan"> {hint.key}</Text>
                <Text color="gray"> {hint.action} </Text>
                {index < row.length - 1 && <Text color="gray">│</Text>}
              </React.Fragment>
            ))}
            {padding > 0 && <Text>{" ".repeat(padding)}</Text>}
          </Box>
        )
      })}
    </Box>
  )
}
