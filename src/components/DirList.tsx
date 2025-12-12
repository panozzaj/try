import React from "react"
import { Box, Text } from "ink"
import type { ScoredEntry } from "../types.js"

interface DirListProps {
  entries: ScoredEntry[]
  selectedIndex: number
  maxVisible?: number
}

/**
 * Highlight matched characters in the name
 */
function HighlightedName({
  name,
  matchedIndices,
  isSelected,
}: {
  name: string
  matchedIndices: number[]
  isSelected: boolean
}) {
  if (matchedIndices.length === 0) {
    return <Text color={isSelected ? "cyan" : undefined}>{name}</Text>
  }

  const parts: React.ReactNode[] = []
  let lastIndex = 0

  for (let i = 0; i < name.length; i++) {
    if (matchedIndices.includes(i)) {
      // Add non-matched prefix
      if (i > lastIndex) {
        parts.push(
          <Text key={`pre-${i}`} color={isSelected ? "cyan" : undefined}>
            {name.slice(lastIndex, i)}
          </Text>
        )
      }
      // Add matched character
      parts.push(
        <Text key={`match-${i}`} color="yellow" bold>
          {name[i]}
        </Text>
      )
      lastIndex = i + 1
    }
  }

  // Add remaining suffix
  if (lastIndex < name.length) {
    parts.push(
      <Text key="suffix" color={isSelected ? "cyan" : undefined}>
        {name.slice(lastIndex)}
      </Text>
    )
  }

  return <>{parts}</>
}

/**
 * Format relative time for display
 */
function formatRelativeTime(date: Date): string {
  const now = Date.now()
  const diff = now - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

export function DirList({ entries, selectedIndex, maxVisible = 10 }: DirListProps) {
  if (entries.length === 0) {
    return (
      <Box paddingLeft={2}>
        <Text color="gray">No directories found</Text>
      </Box>
    )
  }

  // Calculate visible window
  const halfVisible = Math.floor(maxVisible / 2)
  let startIndex = Math.max(0, selectedIndex - halfVisible)
  const endIndex = Math.min(entries.length, startIndex + maxVisible)

  // Adjust start if we're near the end
  if (endIndex - startIndex < maxVisible) {
    startIndex = Math.max(0, endIndex - maxVisible)
  }

  const visibleEntries = entries.slice(startIndex, endIndex)

  return (
    <Box flexDirection="column">
      {startIndex > 0 && (
        <Box paddingLeft={2}>
          <Text color="gray">↑ {startIndex} more</Text>
        </Box>
      )}

      {visibleEntries.map((entry, i) => {
        const actualIndex = startIndex + i
        const isSelected = actualIndex === selectedIndex

        return (
          <Box key={entry.path} paddingLeft={2}>
            <Text color={isSelected ? "cyan" : "gray"}>{isSelected ? "● " : "  "}</Text>
            <Box width={40}>
              <HighlightedName
                name={entry.name}
                matchedIndices={entry.matchedIndices}
                isSelected={isSelected}
              />
            </Box>
            <Text color="gray"> {formatRelativeTime(entry.modifiedAt)}</Text>
          </Box>
        )
      })}

      {endIndex < entries.length && (
        <Box paddingLeft={2}>
          <Text color="gray">↓ {entries.length - endIndex} more</Text>
        </Box>
      )}
    </Box>
  )
}
