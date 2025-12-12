import type { ShellType } from "../types.js";

/**
 * Generate shell initialization script
 *
 * The shell function wraps the try-ink binary and handles cd commands.
 * This is necessary because a subprocess cannot change the parent shell's
 * working directory directly.
 *
 * Users can either:
 * 1. Source the output of `try-ink init` in their shell config
 * 2. Create a shell script wrapper and add it to their PATH
 */
export function generateShellInit(shell: ShellType): string {
  switch (shell) {
    case "bash":
    case "zsh":
      return generateBashZshInit();
    case "fish":
      return generateFishInit();
    default:
      throw new Error(`Unsupported shell: ${shell}`);
  }
}

function generateBashZshInit(): string {
  return `# try-ink shell integration
#
# Option 1: Add to .bashrc/.zshrc:
#   eval "$(try-ink init)"
#
# Option 2: Create a wrapper script (e.g., ~/bin/try):
#   #!/bin/bash
#   output=$(try-ink cd "$@" 2>/dev/tty)
#   [[ $? -eq 0 && -n "$output" ]] && eval "$output"
#
# Then add ~/bin to PATH and use: try

try() {
  local output
  output=$(try-ink cd "$@" 2>/dev/tty)
  local exit_code=$?

  if [[ $exit_code -eq 0 && -n "$output" ]]; then
    eval "$output"
  fi

  return $exit_code
}
`;
}

function generateFishInit(): string {
  return `# try-ink shell integration
#
# Option 1: Add to ~/.config/fish/config.fish:
#   try-ink init fish | source
#
# Option 2: Create ~/.config/fish/functions/try.fish with:
#   function try
#     set -l output (try-ink cd $argv 2>/dev/tty)
#     test $status -eq 0 -a -n "$output" && eval $output
#   end

function try
  set -l output (try-ink cd $argv 2>/dev/tty)
  set -l exit_code $status

  if test $exit_code -eq 0 -a -n "$output"
    eval $output
  end

  return $exit_code
end
`;
}

/**
 * Detect the current shell from environment
 */
export function detectShell(): ShellType {
  const shell = process.env.SHELL || "";

  if (shell.includes("zsh")) {
    return "zsh";
  } else if (shell.includes("fish")) {
    return "fish";
  } else {
    return "bash";
  }
}

/**
 * Generate a cd command for shell evaluation
 */
export function generateCdCommand(dirPath: string): string {
  // Escape single quotes in path
  const escapedPath = dirPath.replace(/'/g, "'\\''");
  return `cd '${escapedPath}'`;
}
