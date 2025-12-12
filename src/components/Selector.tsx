import React, { useState, useMemo } from "react"
import { Box, Text, useInput } from "ink"
import type { TryConfig, TryEntry, SelectorResult } from "../types.js"
import { loadTries } from "../lib/tries.js"
import { scoreEntries, createDirName } from "../lib/scoring.js"
import { SearchInput } from "./SearchInput.js"
import { DirList } from "./DirList.js"
import { DeleteConfirm } from "./DeleteConfirm.js"

interface SelectorProps {
  config: TryConfig
  onResult: (result: SelectorResult) => void
}

type Mode = "search" | "delete"

export function Selector({ config, onResult }: SelectorProps) {
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [mode, setMode] = useState<Mode>("search")
  const [deleteTarget, setDeleteTarget] = useState<TryEntry | null>(null)

  // Load and score entries
  const entries = useMemo(() => loadTries(config), [config])
  const scoredEntries = useMemo(() => scoreEntries(entries, query), [entries, query])

  // When there's a query, add "Create new" as the last option
  const showCreateOption = query.trim().length > 0
  const totalItems = scoredEntries.length + (showCreateOption ? 1 : 0)
  const createNewIndex = showCreateOption ? scoredEntries.length : -1

  // Reset selection when query changes
  const handleQueryChange = (newQuery: string) => {
    setQuery(newQuery)
    setSelectedIndex(0)
  }

  // Handle keyboard input in search mode
  useInput(
    (input, key) => {
      if (mode !== "search") return

      // Navigation - wrap around when at boundaries
      if (key.downArrow || (key.ctrl && input === "n") || input === "j") {
        setSelectedIndex((prev) => (prev + 1) % totalItems)
      } else if (key.upArrow || (key.ctrl && input === "p") || input === "k") {
        setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems)
      }
      // Select current entry
      else if (key.return) {
        if (selectedIndex === createNewIndex) {
          // Create new directory
          onResult({ action: "create", name: createDirName(query) })
        } else if (scoredEntries.length > 0 && selectedIndex < scoredEntries.length) {
          onResult({ action: "select", entry: scoredEntries[selectedIndex] })
        }
      }
      // Delete entry
      else if (input === "d" && key.ctrl) {
        if (selectedIndex < scoredEntries.length && scoredEntries.length > 0) {
          setDeleteTarget(scoredEntries[selectedIndex])
          setMode("delete")
        }
      }
      // Cancel/Exit
      else if (key.escape || (key.ctrl && input === "c")) {
        onResult({ action: "cancel" })
      }
    },
    { isActive: mode === "search" }
  )

  // Delete confirmation handlers
  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      onResult({ action: "delete", entry: deleteTarget })
    }
    setMode("search")
    setDeleteTarget(null)
  }

  const handleDeleteCancel = () => {
    setMode("search")
    setDeleteTarget(null)
  }

  if (mode === "delete" && deleteTarget) {
    return (
      <DeleteConfirm
        entry={deleteTarget}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    )
  }

  const isCreateSelected = selectedIndex === createNewIndex

  return (
    <Box flexDirection="column">
      <SearchInput value={query} onChange={handleQueryChange} placeholder="Search tries..." />

      <Box marginTop={1}>
        <DirList entries={scoredEntries} selectedIndex={selectedIndex} />
      </Box>

      {showCreateOption && (
        <Box marginTop={1} paddingLeft={2}>
          <Text color={isCreateSelected ? "cyan" : "gray"}>{isCreateSelected ? "● " : "  "}</Text>
          <Text color={isCreateSelected ? "green" : "gray"}>
            Create new: {createDirName(query)}
          </Text>
        </Box>
      )}

      <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="cyan">↑↓</Text>
        <Text color="gray"> navigate </Text>
        <Text color="cyan">enter</Text>
        <Text color="gray"> select </Text>
        <Text color="cyan">ctrl+d</Text>
        <Text color="gray"> delete </Text>
        <Text color="cyan">esc</Text>
        <Text color="gray"> cancel</Text>
      </Box>
    </Box>
  )
}
