# try-ink

See README.md for full documentation.

## User Config File

**CRITICAL**: The user's config is at `~/.tryrc.json`. NEVER overwrite this file without first reading and preserving existing content. The user has custom init_actions and templates configured there.

Config structure (see `src/types.ts` for TypeScript types):

```json
{
  "path": "~/src/tries",
  "templates": {
    "name": "shell command with $1 for dir name"
  },
  "init_actions": {
    "key": {
      "label": "Display label",
      "command": "shell command",
      "default": true/false
    }
  },
  "callbacks": {
    "after_create": "script",
    "after_clone": "script"
  }
}
```

When modifying the user's config:

1. Read the existing file first
2. Merge new content with existing
3. Never replace the entire file
