import React, { useState } from "react"
import { Box, Text, useInput } from "ink"

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function SearchInput({ value, onChange, placeholder = "" }: SearchInputProps) {
  const [cursorPos, setCursorPos] = useState(value.length)

  useInput((input, key) => {
    // Backspace - delete char before cursor
    if (key.backspace || key.delete) {
      if (cursorPos > 0) {
        onChange(value.slice(0, cursorPos - 1) + value.slice(cursorPos))
        setCursorPos(cursorPos - 1)
      }
    }
    // Ctrl-H - same as backspace
    else if (key.ctrl && input === "h") {
      if (cursorPos > 0) {
        onChange(value.slice(0, cursorPos - 1) + value.slice(cursorPos))
        setCursorPos(cursorPos - 1)
      }
    }
    // Ctrl-A - beginning of line
    else if (key.ctrl && input === "a") {
      setCursorPos(0)
    }
    // Ctrl-E - end of line
    else if (key.ctrl && input === "e") {
      setCursorPos(value.length)
    }
    // Ctrl-B or left arrow - backward char
    else if ((key.ctrl && input === "b") || key.leftArrow) {
      setCursorPos(Math.max(0, cursorPos - 1))
    }
    // Ctrl-F or right arrow - forward char
    else if ((key.ctrl && input === "f") || key.rightArrow) {
      setCursorPos(Math.min(value.length, cursorPos + 1))
    }
    // Ctrl-K - kill to end of line
    else if (key.ctrl && input === "k") {
      onChange(value.slice(0, cursorPos))
    }
    // Ctrl-U - kill to beginning of line
    else if (key.ctrl && input === "u") {
      onChange(value.slice(cursorPos))
      setCursorPos(0)
    }
    // Ctrl-W - delete word backward
    else if (key.ctrl && input === "w") {
      const beforeCursor = value.slice(0, cursorPos)
      // Find start of previous word (skip trailing non-word chars, then word chars)
      const match = beforeCursor.match(/^(.*?)(\s*\S*)$/)
      if (match) {
        const newBefore = match[1]
        onChange(newBefore + value.slice(cursorPos))
        setCursorPos(newBefore.length)
      }
    }
    // Regular character input
    else if (!key.ctrl && !key.meta && input && !key.return && !key.escape) {
      onChange(value.slice(0, cursorPos) + input + value.slice(cursorPos))
      setCursorPos(cursorPos + input.length)
    }
  })

  // Keep cursor in sync when value changes externally
  React.useEffect(() => {
    if (cursorPos > value.length) {
      setCursorPos(value.length)
    }
  }, [value, cursorPos])

  // Render with cursor
  const beforeCursor = value.slice(0, cursorPos)
  const afterCursor = value.slice(cursorPos)
  const showPlaceholder = !value && placeholder

  return (
    <Box>
      <Text color="cyan">{"> "}</Text>
      {showPlaceholder ? (
        <>
          <Text color="cyan">█</Text>
          <Text color="gray">{placeholder}</Text>
        </>
      ) : (
        <>
          <Text>{beforeCursor}</Text>
          <Text color="cyan">█</Text>
          <Text>{afterCursor}</Text>
        </>
      )}
    </Box>
  )
}
