#!/usr/bin/env node
import React from "react";
import { render } from "ink";
import { program } from "commander";
import { Selector } from "./components/Selector.js";
import { InitActions } from "./components/InitActions.js";
import { loadConfig, ensureTriesDir } from "./lib/config.js";
import { createTryDir, deleteTryDir, touchTryDir, getTryPath } from "./lib/tries.js";
import { executeCallback, runBeforeDelete, runInitAction } from "./lib/callbacks.js";
import { cloneRepo, createWorktree, isInGitRepo } from "./lib/git.js";
import { generateShellInit, detectShell, generateCdCommand } from "./lib/shell.js";
import { createDirName } from "./lib/scoring.js";
import type { SelectorResult, ShellType, TryConfig } from "./types.js";

const config = loadConfig();

/**
 * Show init actions selector and run selected actions
 */
async function runInitActions(cfg: TryConfig, dirPath: string): Promise<void> {
  if (!cfg.init_actions || Object.keys(cfg.init_actions).length === 0) {
    return;
  }

  return new Promise((resolve) => {
    const { unmount } = render(
      <InitActions
        actions={cfg.init_actions!}
        onConfirm={async (selectedKeys) => {
          unmount();
          for (const key of selectedKeys) {
            const action = cfg.init_actions![key];
            console.error(`Running: ${action.label}`);
            const result = await runInitAction(action.command, dirPath);
            if (!result.success) {
              console.error(`  Failed: ${result.stderr}`);
            }
          }
          resolve();
        }}
        onSkip={() => {
          unmount();
          resolve();
        }}
      />
    );
  });
}

/**
 * Handle the result from the selector UI
 */
async function handleSelectorResult(result: SelectorResult): Promise<void> {
  switch (result.action) {
    case "select": {
      // Touch to update access time
      touchTryDir(result.entry.path);
      // Run after_select callback
      await executeCallback(config, "after_select", result.entry.path);
      // Output cd command for shell integration
      console.log(generateCdCommand(result.entry.path));
      break;
    }

    case "create": {
      const fullPath = createTryDir(config, result.name);
      // Show init actions selector
      await runInitActions(config, fullPath);
      // Run after_create callback
      await executeCallback(config, "after_create", fullPath);
      // Output cd command
      console.log(generateCdCommand(fullPath));
      break;
    }

    case "delete": {
      // Run before_delete callback (can abort)
      const { proceed, message } = await runBeforeDelete(
        config,
        result.entry.path
      );

      if (!proceed) {
        console.error(`Delete aborted: ${message}`);
        process.exit(1);
      }

      deleteTryDir(result.entry.path);
      console.error(`Deleted: ${result.entry.name}`);
      break;
    }

    case "cancel":
      // Do nothing
      break;
  }
}

/**
 * Run the interactive selector
 */
function runSelector(): Promise<SelectorResult> {
  return new Promise((resolve) => {
    const { unmount, waitUntilExit } = render(
      <Selector
        config={config}
        onResult={(result) => {
          unmount();
          resolve(result);
        }}
      />
    );
  });
}

// CLI definition
program
  .name("try-ink")
  .description("Interactive directory selector for experiments and scratch projects")
  .version("0.1.0");

// Default command: interactive selector (called via shell wrapper as 'cd')
program
  .command("cd", { isDefault: true })
  .description("Interactive directory selector")
  .action(async () => {
    ensureTriesDir(config);
    const result = await runSelector();
    await handleSelectorResult(result);
  });

// Create a new directory
program
  .command("new [name]")
  .description("Create a new try directory")
  .option("--skip-init", "Skip init actions prompt")
  .action(async (name: string | undefined, options: { skipInit?: boolean }) => {
    ensureTriesDir(config);

    const dirName = createDirName(name || "");
    const fullPath = createTryDir(config, dirName);

    // Show init actions selector (unless skipped)
    if (!options.skipInit) {
      await runInitActions(config, fullPath);
    }

    // Run after_create callback
    await executeCallback(config, "after_create", fullPath);

    // Output cd command
    console.log(generateCdCommand(fullPath));
  });

// Clone a git repository
program
  .command("clone <url>")
  .description("Clone a git repository into a new try directory")
  .option("-n, --name <name>", "Custom name for the directory")
  .option("-s, --shallow", "Create a shallow clone")
  .action(async (url: string, options: { name?: string; shallow?: boolean }) => {
    ensureTriesDir(config);

    const result = await cloneRepo(config, {
      url,
      name: options.name,
      shallow: options.shallow,
    });

    if (!result.success) {
      console.error(`Clone failed: ${result.error}`);
      process.exit(1);
    }

    // Run after_clone callback
    await executeCallback(config, "after_clone", result.path);

    // Output cd command
    console.log(generateCdCommand(result.path));
  });

// Create a git worktree
program
  .command("worktree <branch>")
  .description("Create a git worktree in a new try directory")
  .option("-n, --name <name>", "Custom name for the directory")
  .option("-b, --create-branch", "Create a new branch")
  .action(async (branch: string, options: { name?: string; createBranch?: boolean }) => {
    // Must be in a git repo
    if (!(await isInGitRepo())) {
      console.error("Not in a git repository");
      process.exit(1);
    }

    ensureTriesDir(config);

    const result = await createWorktree(config, {
      branch,
      name: options.name,
      createBranch: options.createBranch,
    });

    if (!result.success) {
      console.error(`Worktree creation failed: ${result.error}`);
      process.exit(1);
    }

    // Run after_worktree callback
    await executeCallback(config, "after_worktree", result.path);

    // Output cd command
    console.log(generateCdCommand(result.path));
  });

// Shell init command
program
  .command("init [shell]")
  .description("Output shell integration script")
  .action((shell?: string) => {
    const shellType: ShellType = (shell as ShellType) || detectShell();
    console.log(generateShellInit(shellType));
  });

// Run a template
program
  .command("template <name> [project-name]")
  .description("Create a new project using a template")
  .action(async (templateName: string, projectName?: string) => {
    ensureTriesDir(config);

    const template = config.templates?.[templateName];
    if (!template) {
      console.error(`Template not found: ${templateName}`);
      console.error("Available templates:", Object.keys(config.templates || {}).join(", ") || "(none)");
      process.exit(1);
    }

    const dirName = createDirName(projectName || templateName);
    const fullPath = getTryPath(config, dirName);

    // Create directory
    createTryDir(config, dirName);

    // Run template script
    const { spawn } = await import("node:child_process");
    const child = spawn("/bin/bash", ["-c", template, "--", fullPath], {
      cwd: fullPath,
      stdio: "inherit",
      env: {
        ...process.env,
        TRY_DIR: fullPath,
      },
    });

    child.on("close", async (code) => {
      if (code !== 0) {
        console.error(`Template script failed with code ${code}`);
        process.exit(code || 1);
      }

      // Run after_create callback
      await executeCallback(config, "after_create", fullPath);

      // Output cd command
      console.log(generateCdCommand(fullPath));
    });
  });

// List configuration
program
  .command("config")
  .description("Show current configuration")
  .action(() => {
    console.log("Configuration:");
    console.log(`  Path: ${config.path}`);
    console.log(`  Init Actions:`);
    if (config.init_actions && Object.keys(config.init_actions).length > 0) {
      for (const [key, action] of Object.entries(config.init_actions)) {
        console.log(`    ${key}: ${action.label}`);
      }
    } else {
      console.log("    (none)");
    }
    console.log(`  Callbacks:`);
    if (config.callbacks && Object.keys(config.callbacks).some(k => config.callbacks![k as keyof typeof config.callbacks])) {
      for (const [hook, script] of Object.entries(config.callbacks)) {
        if (script) {
          const preview = script.length > 50 ? script.slice(0, 50) + "..." : script;
          console.log(`    ${hook}: ${preview.replace(/\n/g, "\\n")}`);
        }
      }
    } else {
      console.log("    (none)");
    }
    console.log(`  Templates:`);
    if (config.templates && Object.keys(config.templates).length > 0) {
      for (const name of Object.keys(config.templates)) {
        console.log(`    ${name}`);
      }
    } else {
      console.log("    (none)");
    }
  });

program.parse();
