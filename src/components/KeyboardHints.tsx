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

  // Account for border (2 chars) and paddingX (2 chars)
  const availableWidth = terminalWidth - 4

  // Split a list of hints into rows that fit within available width
  const splitToFitWidth = (hintList: KeyboardHint[]): KeyboardHint[][] => {
    const result: KeyboardHint[][] = []
    let currentRow: KeyboardHint[] = []
    let currentRowWidth = 0

    hintList.forEach((hint) => {
      const hintWidth = hint.key.length + hint.action.length + 4
      const separatorWidth = currentRow.length > 0 ? 1 : 0

      if (currentRowWidth + hintWidth + separatorWidth > availableWidth && currentRow.length > 0) {
        result.push(currentRow)
        currentRow = [hint]
        currentRowWidth = hintWidth
      } else {
        currentRow.push(hint)
        currentRowWidth += hintWidth + separatorWidth
      }
    })

    if (currentRow.length > 0) {
      result.push(currentRow)
    }
    return result
  }

  // Build initial groups (from explicit breaks or all hints)
  let groups: KeyboardHint[][]
  if (rowBreaks && rowBreaks.length > 0) {
    groups = []
    let startIdx = 0
    for (const breakIdx of rowBreaks) {
      groups.push(hints.slice(startIdx, breakIdx))
      startIdx = breakIdx
    }
    if (startIdx < hints.length) {
      groups.push(hints.slice(startIdx))
    }
  } else {
    groups = [hints]
  }

  // Further split each group to fit within terminal width
  const rows: KeyboardHint[][] = groups.flatMap(splitToFitWidth)

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
