# Gemini Project Instructions: Worktree CLI

This project is a powerful CLI tool (`worktree` or `wt`) designed to manage Git worktrees alongside ticketing systems (GitHub Issues, Linear) and AI-driven development workflows (specifically integrating with Claude Code).

## Project Overview

- **Purpose**: Automates the creation of isolated development environments (Git worktrees) for specific issues, manages tmux sessions for these environments, and orchestrates multiple AI "workers" with specialized roles (archetypes).
- **Core Technologies**: Node.js, TypeScript, Commander.js (CLI), tmux, Git, GitHub CLI (`gh`), Linear SDK, Claude Code.
- **Key Concepts**:
  - **Worktrees**: Isolated directories/branches per issue.
  - **Ticketing**: Integration with GitHub and Linear.
  - **Workers & Archetypes**: Multiple Claude instances with specialized roles (Architect, Detective, Craftsman, etc.).
  - **Worker Pools**: Pre-configured teams of archetypes (e.g., Researchers, Coders, Reviewers).
  - **Orchestration**: Coordination via `WORKTREE_COORDINATION.md` and automated prompts.

## Building and Running

- **Install Dependencies**: `npm install`
- **Build Project**: `npm run build` (Runs `tsc`)
- **Development Mode**: `npm run dev` (Runs `tsc --watch`)
- **Local Setup**: `npm run setup` (Installs, builds, and runs `npm link` to make the `wt` command available globally).
- **Linting**: `npm run lint`

## Project Structure

- `src/index.ts`: CLI entry point and command definitions.
- `src/commands/`: Implementation of CLI subcommands (`open`, `create`, `init`, `list`, `remove`, etc.).
- `src/lib/`: Core logic modules (Git operations, ticketing integration, tmux management, archetypes, configuration).
- `src/templates/`: Markdown and prompt templates for generated context files.
- `skills/`: Integration skills for external agents (e.g., `worktree-orchestrator`).

## Development Conventions

- **Language**: TypeScript (strict mode preferred).
- **CLI Framework**: `commander`.
- **Styling**: `chalk` for terminal output, `ora` for spinners.
- **Configuration**: Uses `.worktree.yml` for project-level settings and `.claude/` for archetype/pool definitions.
- **Testing**: (TODO: No explicit test suite found in `package.json`. Add tests if contributing new features.)

## Orchestration Logic

When contributing to this project, keep in mind its dual role:
1. **Tool for Humans**: Providing a seamless CLI experience for worktree management.
2. **Platform for AI**: Serving as an "OS" for AI agents to collaborate. Changes to coordination templates (`src/templates/coordination.md.ts`) or archetypes (`src/lib/archetypes.ts`) directly affect how AI agents interact.

Refer to `agent-instructions.md` for specific guidance on how AI agents are intended to use this tool.
