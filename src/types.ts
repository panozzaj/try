/**
 * Configuration file structure (~/.tryrc or ~/.config/try/config.yaml)
 */
export interface TryConfig {
  /** Base directory for tries (default: ~/src/tries) */
  path: string
  /** Lifecycle callbacks */
  callbacks?: CallbacksConfig
  /** Custom templates for project scaffolding */
  templates?: Record<string, string>
  /** Init actions shown after creating a new directory */
  init_actions?: Record<string, InitAction>
  /** Command to run after cd'ing into a new directory (runs in parent shell) */
  startup_command?: string
}

/**
 * An init action that can be selected after creating a directory
 */
export interface InitAction {
  /** Display label for the action */
  label: string
  /** Shell command to run ($1 = directory path) */
  command: string
  /** Whether this action is selected by default */
  default?: boolean
}

/**
 * Callback configuration - can be inline script or path to executable
 */
export interface CallbacksConfig {
  /** Runs after mkdir for new empty directory */
  after_create?: string | null
  /** Runs after git clone completes */
  after_clone?: string | null
  /** Runs after git worktree add */
  after_worktree?: string | null
  /** Runs when navigating to existing directory */
  after_select?: string | null
  /** Runs before deletion (can abort if exits non-zero) */
  before_delete?: string | null
}

/**
 * A single try directory entry
 */
export interface TryEntry {
  /** Full path to the directory */
  path: string
  /** Directory name (e.g., "2025-12-12-my-experiment") */
  name: string
  /** When the directory was created */
  createdAt: Date
  /** When the directory was last accessed */
  accessedAt: Date
  /** When the directory was last modified */
  modifiedAt: Date
  /** Parsed date prefix if present (e.g., 2025-12-12) */
  datePrefix?: string
  /** Name without date prefix */
  baseName: string
}

/**
 * Scored entry for display (after fuzzy search and time-based scoring)
 */
export interface ScoredEntry extends TryEntry {
  /** Combined score (higher = better match) */
  score: number
  /** Fuzzy match score component */
  fuzzyScore: number
  /** Time-based score component (recently accessed = higher) */
  timeScore: number
  /** Matched character indices for highlighting */
  matchedIndices: number[]
}

/**
 * Result from the selector UI
 */
export type SelectorResult =
  | { action: "select"; entry: TryEntry }
  | { action: "create"; name: string }
  | { action: "delete"; entry: TryEntry }
  | { action: "archive"; entry: TryEntry }
  | { action: "promote"; entry: TryEntry; targetPath: string; renameClaudeProjects?: boolean }
  | { action: "rename"; entry: TryEntry; newName: string; renameClaudeProjects?: boolean }
  | { action: "cancel" }

/**
 * Callback hook names
 */
export type CallbackHook =
  | "after_create"
  | "after_clone"
  | "after_worktree"
  | "after_select"
  | "before_delete"

/**
 * Result of executing a callback
 */
export interface CallbackResult {
  success: boolean
  exitCode: number
  stdout: string
  stderr: string
}

/**
 * Sort modes for directory listing
 */
export type SortMode = "recent" | "name-desc" | "name-asc" | "label-asc" | "label-desc"

/**
 * Shell types for init command
 */
export type ShellType = "bash" | "zsh" | "fish"

/**
 * Git clone options
 */
export interface CloneOptions {
  url: string
  name?: string
  shallow?: boolean
}

/**
 * Git worktree options
 */
export interface WorktreeOptions {
  branch: string
  name?: string
  createBranch?: boolean
}
