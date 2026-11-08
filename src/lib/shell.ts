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
  # Pass through help/version/config/init/list directly (don't eval their output)
  case "$1" in
    -h|--help|-V|--version|-l|--list|config|init|completions)
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
  # Pass through help/version/config/init/list directly (don't eval their output)
  switch $argv[1]
    case -h --help -V --version -l --list config init completions
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
 * Generate shell completions script
 */
export function generateCompletions(shell: ShellType): string {
  switch (shell) {
    case "zsh":
      return generateZshCompletions()
    case "bash":
      return generateBashCompletions()
    case "fish":
      return generateFishCompletions()
    default:
      throw new Error(`Unsupported shell: ${shell}`)
  }
}

function generateZshCompletions(): string {
  return `# try-ink zsh completions
# Add to .zshrc: eval "$(try-ink completions zsh)"

_try() {
  local -a subcmds
  subcmds=(
    'config:Show configuration'
    'init:Output shell integration script'
  )

  # Complete subcommands as first arg
  if (( CURRENT == 2 )); then
    _alternative \\
      'commands:command:_describe "command" subcmds' \\
      'directories:try directory:_try_dirs'
    return
  fi
}

_try_dirs() {
  local tries_path
  tries_path=$(try-ink _completions-path 2>/dev/null)
  [[ -z "$tries_path" ]] && return 1

  local -a dirs
  dirs=("\${(@f)$(ls -1 "$tries_path" 2>/dev/null)}")
  [[ -z "\${dirs[1]}" ]] && return 1

  compadd -V tries -- "\${dirs[@]}"
}

compdef _try try
`
}

function generateBashCompletions(): string {
  return `# try-ink bash completions
# Add to .bashrc: eval "$(try-ink completions bash)"

_try() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  local tries_path
  tries_path=$(try-ink _completions-path 2>/dev/null)

  if [[ $COMP_CWORD -eq 1 ]]; then
    local subcmds="config init"
    local dirs=""
    if [[ -n "$tries_path" && -d "$tries_path" ]]; then
      dirs=$(ls -1 "$tries_path" 2>/dev/null)
    fi
    COMPREPLY=($(compgen -W "$subcmds $dirs" -- "$cur"))
  fi
}

complete -F _try try
`
}

function generateFishCompletions(): string {
  return `# try-ink fish completions
# Add to config.fish: try-ink completions fish | source

complete -c try -f
complete -c try -n '__fish_use_subcommand' -a 'config' -d 'Show configuration'
complete -c try -n '__fish_use_subcommand' -a 'init' -d 'Output shell integration script'
complete -c try -n '__fish_use_subcommand' -a "(ls -1 (try-ink _completions-path 2>/dev/null) 2>/dev/null)"
`
}

/**
 * Generate a cd command for shell evaluation
 */
export function generateCdCommand(dirPath: string, startupCommand?: string): string {
  // Escape single quotes in path
  const escapedPath = dirPath.replace(/'/g, "'\\''")
  const cd = `cd '${escapedPath}'`
  if (startupCommand) {
    return `${cd} && ${startupCommand}`
  }
  return cd
}
