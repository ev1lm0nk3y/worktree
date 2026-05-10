# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`@agenttools/worktree` — a TypeScript CLI (`worktree` / `wt`) that creates a Git worktree per GitHub issue, sets up a tmux window, generates context files, and launches one or more Claude Code instances inside tmux panes. Target runtime: Node ≥16. Depends on external binaries at runtime: `git`, `tmux`, `gh`, `claude`, and (macOS) iTerm2 via `osascript`.

## Commands

- `npm run build` — compile TypeScript to `dist/` (entry: `dist/index.js`, shebanged).
- `npm run dev` — `tsc --watch`.
- `npm run lint` — ESLint on `src/**/*.ts`.
- `npm start` — runs the built CLI.
- `npm link` — after `build`, exposes `worktree` and `wt` globally for local testing.
- No test runner is configured; do not invent one.

## Architecture

Single-process CLI. `src/index.ts` wires `commander` subcommands to handlers in `src/commands/` (`open`, `split`, `list`, `remove`, `init`, `tldr`). Each handler composes four `lib/` modules:

- `lib/git.ts` — `GitOperations` wraps `git` via `execSync`. Worktree path convention: sibling directory of repo root named `issue-<n>[-<desc>]`. Branch name mirrors directory name. Description is slugified to `[a-z0-9-]`.
- `lib/github.ts` — `GitHubOperations` shells out to `gh` to fetch issue JSON; a missing issue is a hard error in `open`.
- `lib/tmux.ts` — `TmuxOperations` owns session/window/pane lifecycle. Session name comes from config (defaults to `<project>_workers`). Each issue is one tmux window named `issue-<n>`; additional workers are split panes (alternating horizontal/vertical). Claude is launched by `send-keys`-ing `claude` + Enter into a captured `pane_id`, then — after a fixed 5s init delay — send-keys-ing the prompt and Enter. iTerm attach uses a `/tmp/.tmux-<session>-iterm` marker file to detect first-attach vs. switch.
- `lib/config.ts` — `ConfigManager` loads `.worktree.yml` from repo root. When absent, commands are auto-detected from `package.json` / `Cargo.toml` / `pyproject.toml` / `requirements.txt`. `worktree init` writes a default config.

## Agent Orchestration

As an AI agent, you can orchestrate multi-worker workflows using the `wt` CLI. See [agent-instructions.md](agent-instructions.md) for the full guide on team deployment, dynamic scaling via `wt split`, and coordination protocols.

Context files written into each worktree (and appended to its `.gitignore` by `templates/claude.md.ts:ensureGitignore`):

- `CLAUDE.md` — generated from `templates/claude.md.ts` using issue details + project context + commands.
- `WORKTREE_COORDINATION.md` — only when `workers > 1`; carries per-worker archetype assignments.
- `OVERSEER.md` — only when `--watcher` is set.

Multi-worker flow in `commands/open.ts`: Worker 1 is always the Coordinator. Workers 2..N get archetypes from `lib/archetypes.ts` — either interactively via `selectArchetype` (readline wizard) or via `getDefaultArchetypeForWorker` when `--no-wizard`. Valid worker count is 1–5 (enforced). Prompts per worker are produced by `templates/coordination.md.ts:generateWorkerPrompt`; the overseer prompt by `templates/overseer.md.ts:generateOverseerPrompt`.

## Gotchas

- Version string is duplicated: `package.json` `version` and the hardcoded `.version('0.4.2')` in `src/index.ts` must be bumped together.
- `commander`'s `--no-wizard` sets `options.wizard = false` (not a `noWizard` field) — keep the `OpenOptions.wizard` shape.
- `launchClaude*` methods rely on fixed `setTimeout` delays (5s for Claude init, 1s before Enter). Don't remove them without replacing with a readiness check — prompts sent too early are dropped.
- iTerm/AppleScript path in `TmuxOperations.openITerm` is macOS-only; there is no Linux fallback.
- `createWorktree` silently falls back to checking out an existing branch if `-b` fails — intentional, don't "fix" it.
