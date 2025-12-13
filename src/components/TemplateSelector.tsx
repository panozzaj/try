import React, { useState } from "react"
import { Box, Text, useInput } from "ink"
import { KeyboardHints } from "./KeyboardHints.js"

interface TemplateSelectorProps {
  templates: Record<string, string>
  onSelect: (templateKey: string | null) => void
  onCancel: () => void
}

export function TemplateSelector({ templates, onSelect, onCancel }: TemplateSelectorProps) {
  // "empty" is a special key for creating an empty directory
  const options = ["empty", ...Object.keys(templates)]
  const [cursorIndex, setCursorIndex] = useState(0)

  useInput((input, key) => {
    if (key.downArrow || input === "j") {
      setCursorIndex((prev) => Math.min(prev + 1, options.length - 1))
    } else if (key.upArrow || input === "k") {
      setCursorIndex((prev) => Math.max(prev - 1, 0))
    } else if (key.return) {
      const selected = options[cursorIndex]
      onSelect(selected === "empty" ? null : selected)
    } else if (key.escape) {
      onCancel()
    }
  })

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>Choose a template:</Text>
      </Box>

      {options.map((key, index) => {
        const isCursor = index === cursorIndex
        const label = key === "empty" ? "Empty directory" : key
        const command = key === "empty" ? null : templates[key]

        return (
          <Box key={key} paddingLeft={1}>
            <Text color={isCursor ? "cyan" : undefined}>{isCursor ? "> " : "  "}</Text>
            <Text color={isCursor ? "cyan" : undefined} bold={isCursor}>
              {label}
            </Text>
            {command && (
              <Text color="gray" dimColor>
                {" "}
                ({command.length > 40 ? command.slice(0, 40) + "..." : command})
              </Text>
            )}
          </Box>
        )
      })}

      <Box marginTop={1}>
        <KeyboardHints
          hints={[
            { key: "↑↓", action: "navigate" },
            { key: "enter", action: "select" },
            { key: "esc", action: "cancel" },
          ]}
        />
      </Box>
    </Box>
  )
}
