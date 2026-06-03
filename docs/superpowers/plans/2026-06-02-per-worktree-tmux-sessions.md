# Per-Worktree Tmux Sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each `wt open <n>` and `wt create <topic>` its own tmux session so worktrees map 1:1 to iTerm2 tabs.

**Architecture:** Replace the shared `<project>_workers` session with per-worktree sessions named `<slug>-issue-<n>` and `<slug>-guide-<base64url-topic>`. `WorktreeEngine` receives a terminal factory `(sessionName) => ITerminalManager` instead of a pre-built terminal instance, so each method constructs a terminal scoped to its issue. `TmuxOperations.openEditor` upgrades from an empty marker file to one that stores the iTerm2 window+tab IDs for precise tab switching.

**Tech Stack:** TypeScript, Node ≥16, tmux CLI, iTerm2 AppleScript via `osascript`, existing `commander`/`chalk` CLI infra.

---

## File Map

| File | Change |
|------|--------|
| `src/core/config.ts` | Add `getWorktreeSessionName()` and `getGuideSessionName()` |
| `src/core/interfaces.ts` | Add optional `killSession?(): void` to `ITerminalManager` |
| `src/lib/tmux.ts` | Rewrite `openEditor` for tab-ID tracking; add `killSession()`; add `readFileSync` import |
| `src/core/engine.ts` | Constructor takes factory; `launchClaudeWithPrompt` takes terminal param; all `this.terminal` → local `terminal`; add `openEditor` call at end of `open()` |
| `src/commands/open.ts` | Remove terminal construction; pass `getTerminalManager` as factory |
| `src/commands/create.ts` | Same |
| `src/commands/split.ts` | Same; fix `--focus` path to use `openEditor` |
| `src/commands/close.ts` | Use `getWorktreeSessionName`; call `killSession()` instead of `closeWindow` |
| `src/commands/list.ts` | Per-worktree `hasSession()` checks; updated summary line |

---

## Task 1: Add session-naming methods to `ConfigManager`

**Files:**
- Modify: `src/core/config.ts`

- [ ] **Step 1: Add `getWorktreeSessionName` and `getGuideSessionName`**

Open `src/core/config.ts`. After the `getSessionName()` method (ends around line 71), insert:

```typescript
  getWorktreeSessionName(issueNumber: string): string {
    const prefix = this.getProjectName()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return `${prefix}-issue-${issueNumber}`;
  }

  getGuideSessionName(topic: string): string {
    const prefix = this.getProjectName()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const encoded = Buffer.from(topic)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
      .slice(0, 24);
    return `${prefix}-guide-${encoded}`;
  }
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: exits 0, no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/core/config.ts
git commit -m "feat: add per-worktree and per-guide session name methods to ConfigManager"
```

---

## Task 2: Add `killSession` to interface and `TmuxOperations`

**Files:**
- Modify: `src/core/interfaces.ts`
- Modify: `src/lib/tmux.ts`

- [ ] **Step 1: Add `killSession?(): void` to `ITerminalManager`**

In `src/core/interfaces.ts`, add after `cleanup?(): void`:

```typescript
  killSession?(): void;
```

The full bottom of the interface becomes:

```typescript
  closeWindow(windowName: string): void;
  cleanup?(): void;
  killSession?(): void;
}
```

- [ ] **Step 2: Add `readFileSync` to the `tmux.ts` fs import**

In `src/lib/tmux.ts`, change line 2:

```typescript
import { existsSync, writeFileSync, unlinkSync } from 'fs';
```

to:

```typescript
import { existsSync, writeFileSync, unlinkSync, readFileSync } from 'fs';
```

- [ ] **Step 3: Add `killSession()` method to `TmuxOperations`**

In `src/lib/tmux.ts`, add after the `cleanup()` method (around line 234):

```typescript
  killSession(): void {
    this.execSilent(`tmux kill-session -t "${this.sessionName}"`);
    if (existsSync(this.markerFile)) {
      unlinkSync(this.markerFile);
    }
  }
```

- [ ] **Step 4: Verify build passes**

```bash
npm run build
```

Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/core/interfaces.ts src/lib/tmux.ts
git commit -m "feat: add killSession method to TmuxOperations and ITerminalManager interface"
```

---

## Task 3: Rewrite `TmuxOperations.openEditor` for per-session tab tracking

**Files:**
- Modify: `src/lib/tmux.ts`

The marker file at `/tmp/.tmux-<sessionName>-iterm` changes from an empty sentinel to storing `<windowId>:<tabId>`. On first open it captures iTerm2 IDs; on re-open it switches to the exact tab. If the tab no longer exists it falls back to opening a new one.

- [ ] **Step 1: Replace `openEditor` with the new implementation**

Find the existing `openEditor` method (starts around line 188) and replace it entirely with:

```typescript
  openEditor(windowIndex: number, mode: 'window' | 'tab' | 'current' = 'window', focus: boolean = true): void {
    const isNewSession = !existsSync(this.markerFile);
    const attachCmd = `tmux attach -t ${this.sessionName}`;
    const activate = focus ? 'activate' : '';

    if (isNewSession) {
      let openStep: string;
      if (mode === 'tab') {
        openStep = `
          if (count of windows) = 0 then
            create window with default profile
          else
            tell current window to create tab with default profile
          end if`;
      } else if (mode === 'current') {
        openStep = `
          if (count of windows) = 0 then
            create window with default profile
          end if`;
      } else {
        openStep = `create window with default profile`;
      }

      const captureScript = `
        tell application "iTerm"
          ${activate}
          ${openStep}
          tell current session of current window
            write text "${attachCmd}"
          end tell
          set tabId to id of current tab of current window
          set winId to id of current window
          return (winId as text) & ":" & (tabId as text)
        end tell
      `;

      try {
        const result = execSync(`osascript -e '${captureScript}'`, { encoding: 'utf8' }).trim();
        writeFileSync(this.markerFile, result);
      } catch {
        writeFileSync(this.markerFile, '');
      }
    } else {
      const marker = readFileSync(this.markerFile, 'utf8').trim();
      const parts = marker.split(':');
      const winId = parts[0] ? parseInt(parts[0], 10) : NaN;
      const tabId = parts[1] ? parseInt(parts[1], 10) : NaN;

      if (!isNaN(winId) && !isNaN(tabId)) {
        const switchScript = `
          tell application "iTerm"
            activate
            set theWindow to (first window whose id is ${winId})
            tell theWindow
              set theTab to (first tab whose id is ${tabId})
              select theTab
            end tell
          end tell
        `;
        try {
          execSync(`osascript -e '${switchScript}'`);
          return;
        } catch {
          unlinkSync(this.markerFile);
          this.openEditor(windowIndex, mode, focus);
          return;
        }
      } else {
        unlinkSync(this.markerFile);
        this.openEditor(windowIndex, mode, focus);
      }
    }
  }
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/tmux.ts
git commit -m "feat: upgrade openEditor to store and restore iTerm2 tab IDs per session"
```

---

## Task 4: Refactor `WorktreeEngine` to use a terminal factory

**Files:**
- Modify: `src/core/engine.ts`

`WorktreeEngine` currently stores `private terminal: ITerminalManager`. Replace it with `private terminalFactory: (sessionName: string) => ITerminalManager`. Each public method creates its own terminal with the appropriate session name. `launchClaudeWithPrompt` receives the terminal as a parameter instead of using `this.terminal`.

- [ ] **Step 1: Change the constructor**

Find the class declaration and constructor (around line 24):

```typescript
export class WorktreeEngine {
  constructor(
    private terminal: ITerminalManager,
    private logger: ILogger,
    private git: GitOperations,
    private config: ConfigManager
  ) {}
```

Replace with:

```typescript
export class WorktreeEngine {
  constructor(
    private terminalFactory: (sessionName: string) => ITerminalManager,
    private logger: ILogger,
    private git: GitOperations,
    private config: ConfigManager
  ) {}
```

- [ ] **Step 2: Update `launchClaudeWithPrompt` to accept a terminal**

Find the private method (around line 231):

```typescript
  private launchClaudeWithPrompt(targetId: string, prompt: string) {
    this.terminal.runCommand(targetId, 'claude');
    setTimeout(() => {
      this.terminal.runCommand(targetId, prompt);
    }, 5000);
  }
```

Replace with:

```typescript
  private launchClaudeWithPrompt(terminal: ITerminalManager, targetId: string, prompt: string) {
    terminal.runCommand(targetId, 'claude');
    setTimeout(() => {
      terminal.runCommand(targetId, prompt);
    }, 5000);
  }
```

- [ ] **Step 3: Rewrite `open()` to create its own terminal**

At the top of the `open()` method body, after destructuring `options` (around line 33), add:

```typescript
    const terminal = this.terminalFactory(this.config.getWorktreeSessionName(issueNumber));
```

Then replace every `this.terminal` in `open()` with `terminal`.

The early-return block when window already exists (around line 62–76) becomes:

```typescript
      if (terminal.hasWindow(windowName)) {
        this.logger.warn(`⚠️  Session for issue #${issueNumber} already exists`);
        this.logger.info('→ Switching to existing session...');
        if (terminal.openEditor) {
          terminal.openEditor(0, this.config.getItermOpenMode(), this.config.getItermFocus());
        }
        return;
      }
```

The single-worker launch (around line 184):

```typescript
      const { firstPaneId } = await terminal.createWindow(windowName, worktreePath, { instanceName: 'Coordinator', color: 'colour39' });
      this.launchClaudeWithPrompt(terminal, firstPaneId, prompt);
```

The multi-worker coordinator launch (around line 192):

```typescript
      const { firstPaneId } = await terminal.createWindow(windowName, worktreePath, { instanceName: 'Coordinator', color: 'colour39' });
      this.launchClaudeWithPrompt(terminal, firstPaneId, worker1Prompt);
```

Additional workers loop (around line 207):

```typescript
        const paneId = await terminal.splitPane(windowName, worktreePath, direction, config);
        this.launchClaudeWithPrompt(terminal, paneId, workerPrompt);
```

Overseer (around line 219):

```typescript
      const overseerPaneId = await terminal.splitPane(windowName, worktreePath, 'vertical', { instanceName: 'Overseer', color: 'colour208' });
      this.launchClaudeWithPrompt(terminal, overseerPaneId, overseerPrompt);
```

Layout (around line 224):

```typescript
    if (layout && totalPanes > 1) {
      terminal.selectLayout(windowName, layout);
    }
```

At the very end of `open()`, before the closing `}`, add the iTerm2 tab open:

```typescript
    if (terminal.openEditor) {
      terminal.openEditor(0, this.config.getItermOpenMode(), this.config.getItermFocus());
    }
```

- [ ] **Step 4: Rewrite `create()` to create its own terminal**

At the top of the `create()` method body (around line 238), add:

```typescript
    const terminal = this.terminalFactory(this.config.getGuideSessionName(topic));
```

Replace every `this.terminal` in `create()` with `terminal`. The early-return when window exists becomes:

```typescript
    if (terminal.hasWindow(windowName)) {
      this.logger.info(`→ Switching to existing Guide session for: ${topic}`);
      if (terminal.openEditor) {
        terminal.openEditor(0, this.config.getItermOpenMode(), this.config.getItermFocus());
      }
      return;
    }
```

The createWindow call (around line 258):

```typescript
    const { firstPaneId, windowIndex } = await terminal.createWindow(windowName, this.git.repoRoot, { 
      instanceName: 'The Guide', 
      color: guideArchetype.color,
      archetype: guideArchetype
    });

    this.launchClaudeWithPrompt(terminal, firstPaneId, guidePrompt);

    if (terminal.openEditor) {
      terminal.openEditor(windowIndex, this.config.getItermOpenMode(), this.config.getItermFocus());
    }
```

- [ ] **Step 5: Rewrite `split()` to create its own terminal**

At the top of the `split()` method body (around line 274), add:

```typescript
    const terminal = this.terminalFactory(this.config.getWorktreeSessionName(issueNumber));
```

Replace every `this.terminal` in `split()` with `terminal`:

```typescript
    if (!terminal.hasWindow(windowName)) {
      throw new Error(`No terminal window '${windowName}' found.`);
    }
    // ...
    const paneCount = terminal.countPanes ? terminal.countPanes(windowName) : 0;
    // ...
    const newPaneId = await terminal.splitPane(windowName, worktreePath, vertical ? 'vertical' : 'horizontal', config);
    this.launchClaudeWithPrompt(terminal, newPaneId, prompt);
    // ...
          if (terminal.broadcastToPane) {
            terminal.broadcastToPane(paneId, broadcastMessage);
          }
```

- [ ] **Step 6: Verify build passes**

```bash
npm run build
```

Expected: exits 0, no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add src/core/engine.ts
git commit -m "refactor: WorktreeEngine accepts terminal factory instead of terminal instance"
```

---

## Task 5: Update command call sites (`open.ts`, `create.ts`, `split.ts`)

**Files:**
- Modify: `src/commands/open.ts`
- Modify: `src/commands/create.ts`
- Modify: `src/commands/split.ts`

- [ ] **Step 1: Update `open.ts`**

Remove the terminal construction line and update the engine instantiation:

```typescript
// Remove this line:
//   const terminal = getTerminalManager(config.getSessionName());

// Change this:
//   const engine = new WorktreeEngine(terminal, logger, git, config);
// To:
  const engine = new WorktreeEngine(getTerminalManager, logger, git, config);
```

- [ ] **Step 2: Update `create.ts`**

Same pattern — remove terminal construction, pass factory:

```typescript
// Remove this line:
//   const terminal = getTerminalManager(config.getSessionName());

// Change this:
//   const engine = new WorktreeEngine(terminal, logger, git, config);
// To:
  const engine = new WorktreeEngine(getTerminalManager, logger, git, config);
```

- [ ] **Step 3: Update `split.ts`**

Remove terminal construction, pass factory, and fix the `--focus` path:

```typescript
// Remove this line:
//   const terminal = getTerminalManager(config.getSessionName());

// Change this:
//   const engine = new WorktreeEngine(terminal, logger, git, config);
// To:
  const engine = new WorktreeEngine(getTerminalManager, logger, git, config);
```

The `--focus` block currently is:

```typescript
    if (options?.focus) {
      terminal.switchToWindow(`issue-${issueNumber}`);
    }
```

Replace with:

```typescript
    if (options?.focus) {
      const focusTerminal = getTerminalManager(config.getWorktreeSessionName(issueNumber));
      if (focusTerminal.openEditor) {
        focusTerminal.openEditor(0, config.getItermOpenMode(), config.getItermFocus());
      }
    }
```

- [ ] **Step 4: Verify build passes**

```bash
npm run build
```

Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/commands/open.ts src/commands/create.ts src/commands/split.ts
git commit -m "refactor: pass getTerminalManager factory to WorktreeEngine in open, create, split commands"
```

---

## Task 6: Update `close.ts` to kill the per-worktree session

**Files:**
- Modify: `src/commands/close.ts`

Currently `close.ts` closes a window within the shared session. It needs to kill the entire per-worktree session instead.

- [ ] **Step 1: Rewrite `closeCommand`**

Replace the entire body of `closeCommand` with:

```typescript
export async function closeCommand(issueNumber: string): Promise<void> {
  const spinner = ora();

  try {
    const git = new GitOperations();
    const config = new ConfigManager(git.repoRoot);
    const tmux = getTerminalManager(config.getWorktreeSessionName(issueNumber));

    if (!tmux.hasSession()) {
      console.log(chalk.yellow(`No session found for issue #${issueNumber}`));
      process.exit(0);
    }

    spinner.start(`Closing session for issue #${issueNumber}...`);
    if (tmux.killSession) tmux.killSession();
    spinner.succeed(`Closed session for issue #${issueNumber}`);

    const worktrees = git.listWorktrees();
    const worktree = worktrees.find(wt =>
      wt.branch.includes(`issue-${issueNumber}`) ||
      wt.path.includes(`issue-${issueNumber}`)
    );

    if (worktree) {
      console.log(chalk.gray(`Worktree retained at: ${worktree.path}`));
      console.log(chalk.gray(`Reopen with: wt open ${issueNumber}`));
    }

    console.log(chalk.green(`\n✓ Closed session for issue #${issueNumber}`));

  } catch (error: any) {
    spinner.fail();
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/commands/close.ts
git commit -m "feat: close command kills per-worktree tmux session instead of shared window"
```

---

## Task 7: Update `list.ts` for per-session status checks

**Files:**
- Modify: `src/commands/list.ts`

Instead of listing windows in a shared session, check `hasSession()` individually for each worktree.

- [ ] **Step 1: Rewrite `listCommand`**

Replace the entire body of `listCommand` with:

```typescript
export async function listCommand(): Promise<void> {
  try {
    const git = new GitOperations();
    const config = new ConfigManager(git.repoRoot);

    const worktrees = git.listWorktrees();

    if (worktrees.length === 0) {
      console.log('No worktrees found');
      return;
    }

    console.log('\nWorktrees:\n');

    let liveSessions = 0;
    let totalWorktrees = 0;

    for (const worktree of worktrees) {
      if (worktree.path === git.repoRoot) continue;
      totalWorktrees++;

      const issueMatch = worktree.branch.match(/issue-(\d+)/);
      const issueNumber = issueMatch ? issueMatch[1] : null;

      const terminal = issueNumber
        ? getTerminalManager(config.getWorktreeSessionName(issueNumber))
        : null;
      const isLive = terminal ? terminal.hasSession() : false;
      if (isLive) liveSessions++;

      const paneCount = isLive && terminal?.countPanes && issueNumber
        ? terminal.countPanes(`issue-${issueNumber}`)
        : 0;

      let lastModified = 'Unknown';
      const claudePath = path.join(worktree.path, 'WORKTREE_TICKET.md');
      if (existsSync(claudePath)) {
        const stats = statSync(claudePath);
        const now = new Date();
        const diff = now.getTime() - stats.mtime.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);

        if (days > 0) lastModified = `${days}d ago`;
        else if (hours > 0) lastModified = `${hours}h ago`;
        else lastModified = 'Recently';
      }

      const status = issueNumber ? `Issue #${issueNumber}` : worktree.branch;

      let tmuxStatus = 'No session';
      if (isLive) {
        tmuxStatus = 'Session active';
        if (paneCount > 1) tmuxStatus += ` [${paneCount} panes]`;
      }

      console.log(`${status} - ${path.basename(worktree.path)}`);
      console.log(`  Path: ${worktree.path}`);
      console.log(`  Tmux: ${tmuxStatus}`);
      console.log(`  Modified: ${lastModified}`);
      console.log('');
    }

    console.log(`Active sessions: ${liveSessions} / ${totalWorktrees}`);

  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/commands/list.ts
git commit -m "feat: list command checks per-worktree sessions instead of shared session windows"
```

---

## Task 8: Final build and smoke test

- [ ] **Step 1: Full build and lint**

```bash
npm run build && npm run lint
```

Expected: both exit 0.

- [ ] **Step 2: Link for manual testing**

```bash
npm link
```

- [ ] **Step 3: Verify session naming**

In a repo where `.worktree.yml` has `name: myproject` (or falls back to git dir name), run:

```bash
node -e "
const { ConfigManager } = require('./dist/core/config.js');
const c = new ConfigManager(process.cwd());
console.log(c.getWorktreeSessionName('123'));
console.log(c.getGuideSessionName('add user auth'));
"
```

Expected output (with repo named `worktree`):
```
worktree-issue-123
worktree-guide-YWRkIHVzZXIgYXV0aA
```

- [ ] **Step 4: Verify `wt open` creates a new tmux session**

```bash
wt open <any-existing-issue-number>
tmux ls
```

Expected: a session named `<repo>-issue-<n>` appears. No session named `<project>_workers`.

- [ ] **Step 5: Verify `wt close` kills the session**

```bash
wt close <issue-number>
tmux ls
```

Expected: the `<repo>-issue-<n>` session is gone.

- [ ] **Step 6: Verify re-open switches iTerm2 tab**

Run `wt open <n>` twice. The second invocation should bring the existing iTerm2 tab to focus rather than opening a new one.
