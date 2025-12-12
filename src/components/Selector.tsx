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

  // Reset selection when query changes
  const handleQueryChange = (newQuery: string) => {
    setQuery(newQuery)
    setSelectedIndex(0)
  }

  // Handle keyboard input in search mode
  useInput(
    (input, key) => {
      if (mode !== "search") return

      // Navigation
      if (key.downArrow || (key.ctrl && input === "n") || input === "j") {
        setSelectedIndex((prev) => Math.min(prev + 1, scoredEntries.length - 1))
      } else if (key.upArrow || (key.ctrl && input === "p") || input === "k") {
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      }
      // Select current entry
      else if (key.return) {
        if (scoredEntries.length > 0) {
          onResult({ action: "select", entry: scoredEntries[selectedIndex] })
        } else if (query.trim()) {
          // Create new directory with query as name
          onResult({ action: "create", name: createDirName(query) })
        }
      }
      // Delete entry
      else if (input === "d" && key.ctrl) {
        if (scoredEntries.length > 0) {
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

  const showCreateHint = query.trim() && scoredEntries.length === 0

  return (
    <Box flexDirection="column">
      <SearchInput value={query} onChange={handleQueryChange} placeholder="Search tries..." />

      <Box marginTop={1}>
        <DirList entries={scoredEntries} selectedIndex={selectedIndex} />
      </Box>

      {showCreateHint && (
        <Box marginTop={1} paddingLeft={2}>
          <Text color="green">Press Enter to create: {createDirName(query)}</Text>
        </Box>
      )}

      <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="gray">↑↓ navigate enter select ctrl+d delete esc cancel</Text>
      </Box>
    </Box>
  )
}
