#!/bin/bash
# Claude Code post-tool-use hook
# Runs eslint and prettier on modified files

TOOL_NAME="$1"
FILE_PATH="$2"

# Only run on Edit/Write tools for source files
if [[ "$TOOL_NAME" =~ ^(Edit|Write)$ ]] && [[ "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]]; then
  npx eslint --fix "$FILE_PATH" 2>/dev/null
  npx prettier --write "$FILE_PATH" 2>/dev/null
fi
