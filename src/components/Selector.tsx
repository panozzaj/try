import React, { useState, useMemo } from "react"
import { Box, Text, useInput, useStdout } from "ink"
import * as path from "node:path"
import { execSync } from "node:child_process"
import type { TryConfig, TryEntry, SelectorResult } from "../types.js"
import { loadTries } from "../lib/tries.js"
import { scoreEntries, createDirName } from "../lib/scoring.js"
import { expandPath } from "../lib/config.js"
import { SearchInput } from "./SearchInput.js"
import { DirList } from "./DirList.js"
import { DeleteConfirm } from "./DeleteConfirm.js"
import { ArchiveConfirm } from "./ArchiveConfirm.js"
import { PromoteConfirm } from "./PromoteConfirm.js"
import { KeyboardHints } from "./KeyboardHints.js"

/**
 * Copy text to clipboard (macOS)
 */
function copyToClipboard(text: string): boolean {
  try {
    execSync("pbcopy", { input: text })
    return true
  } catch {
    return false
  }
}

interface SelectorProps {
  config: TryConfig
  onResult: (result: SelectorResult) => void
  initialQuery?: string
}

type Mode = "search" | "delete" | "archive" | "promote"

export function Selector({ config, onResult, initialQuery = "" }: SelectorProps) {
  const [query, setQuery] = useState(initialQuery)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [mode, setMode] = useState<Mode>("search")
  const [deleteTarget, setDeleteTarget] = useState<TryEntry | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<TryEntry | null>(null)
  const [promoteTarget, setPromoteTarget] = useState<TryEntry | null>(null)
  const [copiedPath, setCopiedPath] = useState<string | null>(null)
  const [showHints, setShowHints] = useState<boolean | null>(null) // null = auto

  const { stdout } = useStdout()
  const terminalHeight = stdout?.rows ?? 24

  // Auto-hide hints on small terminals (< 20 rows)
  const isSmallTerminal = terminalHeight < 20
  const hintsVisible = showHints === null ? !isSmallTerminal : showHints

  // Calculate maxVisible based on terminal height
  // Reserve space for: SearchInput(1) + margin(1) + overflow indicators(2) +
  // Create option(2) + margin(1) + KeyboardHints(2) + copied msg(2) = ~11 lines
  // If hints hidden, we get back ~3 lines
  const reservedLines = hintsVisible ? 11 : 8
  const maxVisible = Math.max(3, terminalHeight - reservedLines)

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
        // Exit if user types "exit" or "q"
        const trimmedQuery = query.trim().toLowerCase()
        if (trimmedQuery === "exit" || trimmedQuery === "q") {
          onResult({ action: "cancel" })
        } else if (selectedIndex === createNewIndex) {
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
      // Promote entry (ctrl+o for "out")
      else if (input === "o" && key.ctrl) {
        if (selectedIndex < scoredEntries.length && scoredEntries.length > 0) {
          setPromoteTarget(scoredEntries[selectedIndex])
          setMode("promote")
        }
      }
      // Archive entry (ctrl+a)
      else if (input === "a" && key.ctrl) {
        if (selectedIndex < scoredEntries.length && scoredEntries.length > 0) {
          setArchiveTarget(scoredEntries[selectedIndex])
          setMode("archive")
        }
      }
      // Copy path to clipboard (ctrl+y for "yank")
      else if (input === "y" && key.ctrl) {
        if (selectedIndex < scoredEntries.length && scoredEntries.length > 0) {
          const entry = scoredEntries[selectedIndex]
          if (copyToClipboard(entry.path)) {
            setCopiedPath(entry.path)
            setTimeout(() => setCopiedPath(null), 1500)
          }
        }
      }
      // Toggle hints (ctrl+h)
      else if (input === "h" && key.ctrl) {
        setShowHints((prev) => (prev === null ? isSmallTerminal : !prev))
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

  // Archive confirmation handlers
  const handleArchiveConfirm = () => {
    if (archiveTarget) {
      onResult({ action: "archive", entry: archiveTarget })
    }
    setMode("search")
    setArchiveTarget(null)
  }

  const handleArchiveCancel = () => {
    setMode("search")
    setArchiveTarget(null)
  }

  // Promote confirmation handlers
  const handlePromoteConfirm = (targetPath: string) => {
    if (promoteTarget) {
      onResult({ action: "promote", entry: promoteTarget, targetPath })
    }
    setMode("search")
    setPromoteTarget(null)
  }

  const handlePromoteCancel = () => {
    setMode("search")
    setPromoteTarget(null)
  }

  // Calculate default promote target path
  const getDefaultPromoteTarget = (entry: TryEntry): string => {
    const triesPath = expandPath(config.path)
    const parentDir = path.dirname(triesPath)
    return path.join(parentDir, entry.baseName)
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

  if (mode === "archive" && archiveTarget) {
    const archivePath = path.join(expandPath(config.path), "archive")
    return (
      <ArchiveConfirm
        entry={archiveTarget}
        archivePath={archivePath}
        onConfirm={handleArchiveConfirm}
        onCancel={handleArchiveCancel}
      />
    )
  }

  if (mode === "promote" && promoteTarget) {
    return (
      <PromoteConfirm
        entry={promoteTarget}
        defaultTarget={getDefaultPromoteTarget(promoteTarget)}
        onConfirm={handlePromoteConfirm}
        onCancel={handlePromoteCancel}
      />
    )
  }

  const isCreateSelected = selectedIndex === createNewIndex

  return (
    <Box flexDirection="column">
      <SearchInput value={query} onChange={handleQueryChange} />

      <Box marginTop={1}>
        <DirList entries={scoredEntries} selectedIndex={selectedIndex} maxVisible={maxVisible} />
      </Box>

      {showCreateOption && (
        <Box marginTop={1} paddingLeft={2}>
          <Text color={isCreateSelected ? "cyan" : "gray"}>{isCreateSelected ? "● " : "  "}</Text>
          <Text color={isCreateSelected ? "green" : "gray"}>
            Create new: {createDirName(query)}
          </Text>
        </Box>
      )}

      {hintsVisible ? (
        <Box marginTop={1}>
          <KeyboardHints
            hints={[
              { key: "↑↓", action: "navigate" },
              { key: "enter", action: "select" },
              { key: "ctrl+y", action: "copy path" },
              { key: "ctrl+a", action: "archive" },
              { key: "ctrl+d", action: "delete" },
              { key: "ctrl+o", action: "promote" },
              { key: "ctrl+h", action: "hide help" },
              { key: "esc", action: "cancel" },
            ]}
          />
        </Box>
      ) : (
        <Box marginTop={1}>
          <Text color="gray">ctrl+h for help</Text>
        </Box>
      )}

      {copiedPath && (
        <Box marginTop={1}>
          <Text color="green">Copied: {copiedPath}</Text>
        </Box>
      )}
    </Box>
  )
}
