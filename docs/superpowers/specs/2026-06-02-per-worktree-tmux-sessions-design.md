# Per-Worktree Tmux Sessions

**Date:** 2026-06-02
**Status:** Approved

## Problem

All worktrees share a single tmux session (`<project>_workers`), with each worktree as a window inside it. Switching between worktrees requires switching tmux windows (`C-b <n>`), not iTerm2 tabs. With many simultaneous worktrees this is friction-heavy.

## Goal

Each `wt open <n>` and `wt create <topic>` gets its own tmux session. Each session maps to one iTerm2 tab. Switching worktrees = switching iTerm2 tabs.

---

## Architecture

### Session naming (`ConfigManager`)

Two new methods. Both use `getProjectName()` slugified to `[a-z0-9-]` as the prefix — the configured `name:` field in `.worktree.yml` takes precedence over the git repo directory name.

```
getWorktreeSessionName(issueNumber: string): string
  → "<slug>-issue-<n>"
  e.g. "worktree-issue-123"

getGuideSessionName(topic: string): string
  → "<slug>-guide-<base64url(topic).slice(0, 24)>"
  e.g. "worktree-guide-YWRkIHVzZXIgYXV0aGVud"
```

Base64url encoding (`+→-`, `/→_`, `=` stripped) is tmux-safe and deterministic. 24 chars keeps total session names under ~50 chars. The existing `getSessionName()` is left in place but no longer called for issue or guide sessions.

### Terminal factory (`WorktreeEngine`)

`WorktreeEngine` currently takes a `terminal: ITerminalManager` constructed before the issue number is known. Change the constructor to accept a factory instead:

```ts
// Before (open.ts, split.ts, create.ts)
const terminal = getTerminalManager(config.getSessionName());
const engine = new WorktreeEngine(terminal, logger, git, config);

// After
const engine = new WorktreeEngine(getTerminalManager, logger, git, config);
```

Each engine method creates its own terminal on demand:

```ts
// engine.open()  →  this.terminalFactory(this.config.getWorktreeSessionName(issueNumber))
// engine.create() →  this.terminalFactory(this.config.getGuideSessionName(topic))
// engine.split()  →  this.terminalFactory(this.config.getWorktreeSessionName(issueNumber))
```

`TmuxOperations` itself is unchanged — it still takes a `sessionName` string and operates on exactly that session.

### iTerm2 tab tracking (`TmuxOperations.openEditor`)

The marker file at `/tmp/.tmux-<sessionName>-iterm` changes from a boolean sentinel to storing `<windowId>:<tabId>` so re-opens switch to the exact right iTerm2 tab.

**First open** (marker absent):
1. Create the tmux session
2. AppleScript: open new iTerm2 tab, run `tmux attach -t <sessionName>`, capture window+tab IDs
3. Write `<windowId>:<tabId>` to the marker file

**Re-open** (marker present):
1. Read `<windowId>:<tabId>` from marker file
2. AppleScript: `tell application "iTerm" to tell window id <wid> to select tab id <tid>` + activate
3. If that tab no longer exists, fall back to opening a new tab and overwrite the marker

The `windowIndex` parameter to `openEditor` becomes unused (no intra-session window switching needed) but is kept in the signature to avoid breaking `ITerminalManager`.

### Session teardown (`close.ts`)

`close.ts` constructs a terminal with `getWorktreeSessionName(issueNumber)` and calls `terminal.killSession()` instead of `terminal.closeWindow(windowName)`.

New method on `TmuxOperations`:
```ts
killSession(): void  →  tmux kill-session -t "<sessionName>" + delete marker file
```

Added as `killSession?(): void` (optional) on `ITerminalManager`.

The existing empty-session cleanup block at the bottom of `close.ts` is removed — killing the session is the whole operation.

### `list.ts`

Per worktree with a parseable issue number, instantiate a terminal with `getWorktreeSessionName(issueNumber)` and call `hasSession()`:

- Status line changes from `"Window 2 [3 panes]"` to `"Session active [3 panes]"` or `"No session"`
- Bottom summary changes from `"Tmux session: X, Active windows: N"` to `"Active sessions: N / M"`

---

## Files changed

| File | Change |
|------|--------|
| `src/core/config.ts` | Add `getWorktreeSessionName()`, `getGuideSessionName()` |
| `src/core/interfaces.ts` | Add optional `killSession?(): void` to `ITerminalManager` |
| `src/core/engine.ts` | Constructor takes `(sessionName: string) => ITerminalManager` factory; each method creates terminal locally |
| `src/lib/tmux.ts` | Update `openEditor` to store/read iTerm2 window+tab IDs; add `killSession()` |
| `src/commands/open.ts` | Pass `getTerminalManager` factory instead of terminal instance |
| `src/commands/split.ts` | Pass factory; the `--focus` path that currently calls `terminal.switchToWindow()` directly should instead construct a terminal via `getTerminalManager(config.getWorktreeSessionName(issueNumber))` and call `openEditor` to bring the iTerm2 tab to focus |
| `src/commands/create.ts` | Same |
| `src/commands/close.ts` | Use `getWorktreeSessionName`; call `killSession()` instead of `closeWindow` |
| `src/commands/list.ts` | Per-worktree session checks |

---

## Out of scope

- VSCode terminal manager (no session concept; `getTerminalManager` already routes away from tmux in VSCode)
- `wt remove` (removes the git worktree; session teardown remains a separate `wt close` concern)
- Multi-project session collision (mitigated by the `<slug>-` prefix)
