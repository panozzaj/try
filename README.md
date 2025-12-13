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

- Templates for project scaffolding (rails new, laravel new, etc.)
- Promote directories to permanent locations (Ctrl+O)
- Init actions menu after creating directories
- Type directory name to confirm deletion (safer than y/n)
- JSON config format

## Install

```bash
npm install
```

**Development mode** (runs source directly, changes take effect immediately):

```bash
echo '#!/usr/bin/env bash
cd '"$(pwd)"' && exec npx tsx src/cli.tsx "$@"' > ~/.local/bin/try-ink
chmod +x ~/.local/bin/try-ink
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
try . my-feature                       # Create worktree from current git repo
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
    "rails": "rails new \"$1\" --name \"$TRY_ID\" --skip-git",
    "laravel": "laravel new \"$1\""
  }
}
```

### Templates

Templates let you scaffold new projects using generators like `rails new` or `laravel new`. When you create a new directory, you'll be prompted to choose a template (or "Empty directory").

The command receives:

- `$1` = directory name (e.g., `2025-12-12-myapp`)
- `TRY_DIR` = full path
- `TRY_NAME` = directory name (e.g., `2025-12-12-myapp`)
- `TRY_BASE` = base name without date (e.g., `myapp`)
- `TRY_ID` = identifier-safe name with underscores (e.g., `my_app`)

Templates run in the tries directory and are expected to create the target directory themselves.

For Rails, use `--name` to set the app name separately from the directory:

```json
"rails": "rails new \"$1\" --name \"$TRY_ID\" --skip-git"
```

## Development

```bash
npm run dev      # Run directly
npm test         # Run tests
npm run build    # Build to dist/
```
