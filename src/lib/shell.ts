import type { ShellType } from "../types.js"

/**
 * Generate shell initialization script
 *
 * The shell function wraps the try binary and handles cd commands.
 * This is necessary because a subprocess cannot change the parent shell's
 * working directory directly.
 */
export function generateShellInit(shell: ShellType): string {
  switch (shell) {
    case "bash":
    case "zsh":
      return generateBashZshInit()
    case "fish":
      return generateFishInit()
    default:
      throw new Error(`Unsupported shell: ${shell}`)
  }
}

function generateBashZshInit(): string {
  return `# try shell integration
# Add to .bashrc/.zshrc: eval "$(try-ink init)"

try() {
  # Pass through help/version/config/init directly (don't eval their output)
  case "$1" in
    -h|--help|-V|--version|config|init)
      try-ink "$@"
      return $?
      ;;
  esac

  local output
  output=$(FORCE_COLOR=1 try-ink "$@" 2>/dev/tty)
  local exit_code=$?

  if [[ $exit_code -eq 0 && -n "$output" ]]; then
    eval "$output"
  fi

  return $exit_code
}
`
}

function generateFishInit(): string {
  return `# try shell integration
# Add to ~/.config/fish/config.fish: try-ink init fish | source

function try
  # Pass through help/version/config/init directly (don't eval their output)
  switch $argv[1]
    case -h --help -V --version config init
      try-ink $argv
      return $status
  end

  set -l output (env FORCE_COLOR=1 try-ink $argv 2>/dev/tty)
  set -l exit_code $status

  if test $exit_code -eq 0 -a -n "$output"
    eval $output
  end

  return $exit_code
end
`
}

/**
 * Detect the current shell from environment
 */
export function detectShell(): ShellType {
  const shell = process.env.SHELL || ""

  if (shell.includes("zsh")) {
    return "zsh"
  } else if (shell.includes("fish")) {
    return "fish"
  } else {
    return "bash"
  }
}

/**
 * Generate a cd command for shell evaluation
 */
export function generateCdCommand(dirPath: string): string {
  // Escape single quotes in path
  const escapedPath = dirPath.replace(/'/g, "'\\''")
  return `cd '${escapedPath}'`
}
