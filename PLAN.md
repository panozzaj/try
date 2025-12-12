# try-ink

A React Ink-based clone of [tobi/try](https://github.com/tobi/try) with config file support and lifecycle hooks.

## Goals

1. Feature parity with tobi/try
2. Config file support (`~/.tryrc` or `~/.config/try/config.yaml`)
3. Rails-style lifecycle callbacks (`after_create`, `after_clone`, etc.)
4. TypeScript + React Ink for the TUI

## Core Features (from tobi/try)

- [ ] Interactive directory selector with fuzzy search
- [ ] Date-prefixed directory names (e.g., `2025-12-12-my-experiment`)
- [ ] Time-aware sorting (recently accessed bubbles up)
- [ ] Create new directories
- [ ] Navigate to existing directories
- [ ] Delete directories (with confirmation)
- [ ] `try clone <git-url>` - clone repo into dated directory
- [ ] `try worktree` - create git worktree from current repo
- [ ] `try init` - shell integration (bash/zsh/fish)
- [ ] Keyboard navigation (arrows, ctrl-p/n/j/k)

## New Features

- [ ] Config file support
  ```yaml
  # ~/.tryrc (YAML)
  path: ~/src/tries
  callbacks:
    after_create: |
      git init "$1"
      jj git init --colocate "$1"
    after_clone: ~/.config/try/hooks/after_clone
    after_worktree: null
  templates:
    laravel: |
      laravel new "$1"
    rails: |
      rails new "$1" --skip-git
  ```
- [ ] Custom templates (`try new laravel myapp` runs the laravel template)
- [ ] Inline scripts or path to executable for callbacks

## Callbacks

| Hook | Trigger | Use Cases |
|------|---------|-----------|
| `after_create` | After `mkdir` for new empty directory | git init, jj colocate, create README |
| `after_clone` | After `git clone` completes | jj colocate, install deps, setup hooks |
| `after_worktree` | After `git worktree add` | install deps, setup environment |
| `after_select` | When navigating to existing dir | refresh deps, show status |
| `before_delete` | Before deletion (can abort) | backup, confirmation |

## Tech Stack

- TypeScript
- React Ink (TUI framework)
- Commander or yargs (CLI parsing)
- js-yaml (config parsing)
- fzf-like fuzzy matching (fuse.js or similar)
- Bun for bundling (same approach as Claude Code)
- Distributed via npm, requires Node.js on user's machine

### Distribution Decision

We chose to follow Claude Code's distribution model:
- Bun bundles TypeScript + Ink into a single JS file
- Published to npm for `npm install -g try-ink`
- Requires Node.js runtime on user's machine

Alternatives considered but deferred:
- Bun compile to standalone binary (no Node required) - could add later
- Lighter TUI library - Ink provides better component model for complex UI

## Architecture

```
src/
  cli.tsx           # Entry point, command routing
  components/
    Selector.tsx    # Main interactive selector
    SearchInput.tsx # Fuzzy search input
    DirList.tsx     # Directory listing with scores
    DeleteConfirm.tsx
  hooks/
    useTries.ts     # Load/filter/sort directories
    useConfig.ts    # Load ~/.tryrc
  lib/
    scoring.ts      # Fuzzy match + time-based scoring
    shell.ts        # Generate shell init scripts
    callbacks.ts    # Execute lifecycle hooks
    git.ts          # Clone/worktree helpers
  types.ts
```

## Shell Integration

Same pattern as tobi/try - `try init` outputs a shell function that wraps the binary:

```bash
try() {
  cmd=$(try-ink cd "$@" 2>/dev/tty)
  eval "$cmd"
}
```

## Implementation Order

1. Basic project setup (package.json, tsconfig, ink)
2. Config file loading
3. Directory listing + fuzzy search
4. Interactive selector UI
5. Create new directory (with after_create callback)
6. Shell init command
7. Clone command (with after_clone callback)
8. Worktree command
9. Delete functionality
10. Templates feature

## References

- [tobi/try source](https://github.com/tobi/try/blob/main/try.rb)
- [React Ink docs](https://github.com/vadimdemedes/ink)
- [Issue #61 - laravel new use case](https://github.com/tobi/try/issues/61)
