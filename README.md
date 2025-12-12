# try

A TypeScript/React Ink clone of [tobi/try](https://github.com/tobi/try) - an interactive directory selector for experiments and scratch projects.

## Install

```bash
bun install
bun run build
ln -s "$(pwd)/dist/cli.js" ~/.local/bin/try
```

## Shell integration

To enable `cd` functionality, add a wrapper. The binary can't change your shell's directory directly.

**Zsh/Bash** - add to `~/.zshrc`:
```bash
eval "$(try init)"
```

## Usage

```bash
try              # Interactive selector
try new foo      # Create 2025-12-12-foo directory
try clone https://github.com/user/repo
try config       # Show configuration
```

## Config

Create `~/.tryrc`:

```yaml
path: ~/src/tries
callbacks:
  after_create: |
    git init "$1"
  after_clone: ~/.config/try/hooks/after_clone
templates:
  rails: rails new "$1" --skip-git
```

## Development

```bash
bun run dev      # Run directly
bun test         # Run tests
bun run build    # Build to dist/
```
