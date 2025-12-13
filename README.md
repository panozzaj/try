# try

A TypeScript/React Ink clone of [tobi/try](https://github.com/tobi/try) - an interactive directory selector for experiments and scratch projects.

## Features

- fzf-style subsequence filtering
- Time-based sorting (recent first)
- Match highlighting
- Readline keybindings (Ctrl-A/E/B/F/K/U/W)
- Git clone and worktree support
- Configurable callbacks and templates

**New in try-ink:**

- Init actions menu after creating directories
- Type directory name to confirm deletion (safer than y/n)
- JSON config format

## Install

```bash
bun install
```

**Option A: Development mode** (runs source directly, changes take effect immediately):

```bash
echo '#!/usr/bin/env bash
cd '"$(pwd)"' && exec npx tsx src/cli.tsx "$@"' > ~/.local/bin/try-ink
chmod +x ~/.local/bin/try-ink
```

**Option B: Built mode** (faster startup, requires rebuild after changes):

```bash
bun run build
ln -s "$(pwd)/dist/cli.js" ~/.local/bin/try-ink
```

## Shell integration

To enable `cd` functionality, add a wrapper. The binary can't change your shell's directory directly.

**Zsh/Bash** - add to `~/.zshrc`:

```bash
eval "$(try-ink init)"
```

This creates a `try` shell function that wraps `try-ink`.

## Usage

```bash
try                                    # Interactive selector
try foo                                # Selector with "foo" pre-filled
try https://github.com/user/repo       # Clone repository
try config                             # Show configuration
```

## Config

Default tries path: `~/src/tries`

Create `~/.tryrc.json` to customize:

```json
{
  "path": "~/src/tries",
  "callbacks": {
    "after_create": "git init \"$1\""
  },
  "init_actions": {
    "git": {
      "label": "git init",
      "command": "git init \"$1\""
    },
    "jj": {
      "label": "jj git init --colocate",
      "command": "jj git init --colocate \"$1\""
    }
  },
  "templates": {
    "rails": "rails new \"$1\" --skip-git"
  }
}
```

## Development

```bash
bun run dev      # Run directly
bun test         # Run tests
bun run build    # Build to dist/
```
