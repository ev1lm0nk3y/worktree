import { execSync } from 'child_process';
import { existsSync, writeFileSync, unlinkSync } from 'fs';
import chalk from 'chalk';

export interface ClaudeInstanceConfig {
  instanceName?: string;  // passed as --name to claude CLI
  color?: string;         // tmux colour for pane title and border styling
}

export interface TmuxWindow {
  index: number;
  name: string;
  active: boolean;
  panes: number;
}

export class TmuxOperations {
  private sessionName: string;
  private markerFile: string;

  constructor(sessionName: string) {
    this.sessionName = sessionName;
    this.markerFile = `/tmp/.tmux-${sessionName}-iterm`;
  }

  private exec(command: string): string {
    try {
      return execSync(command, { encoding: 'utf8' }).trim();
    } catch (error: any) {
      throw new Error(`Tmux command failed: ${error.message}`);
    }
  }

  private execSilent(command: string): boolean {
    try {
      execSync(command, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  hasSession(): boolean {
    return this.execSilent(`tmux has-session -t "${this.sessionName}"`);
  }

  hasWindow(windowName: string): boolean {
    if (!this.hasSession()) return false;
    
    const windows = this.listWindows();
    return windows.some(w => w.name === windowName);
  }

  listWindows(): TmuxWindow[] {
    if (!this.hasSession()) return [];

    try {
      const output = this.exec(
        `tmux list-windows -t "${this.sessionName}" -F "#{window_index}:#{window_name}:#{window_active}:#{window_panes}"`
      );
      
      return output.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [index, name, active, panes] = line.split(':');
          return {
            index: parseInt(index),
            name,
            active: active === '1',
            panes: parseInt(panes)
          };
        });
    } catch {
      return [];
    }
  }

  createWindow(windowName: string, workingDirectory: string): { windowIndex: number; firstPaneId: string } {
    let firstPaneId: string;
    
    if (!this.hasSession()) {
      // Create session with first window and capture pane ID
      const output = this.exec(
        `tmux new-session -d -s "${this.sessionName}" -n "${windowName}" -c "${workingDirectory}" -P -F "#{pane_id}"`
      );
      firstPaneId = output.trim();
    } else if (!this.hasWindow(windowName)) {
      // Add window to existing session and capture pane ID
      const output = this.exec(
        `tmux new-window -t "${this.sessionName}" -n "${windowName}" -c "${workingDirectory}" -P -F "#{pane_id}"`
      );
      firstPaneId = output.trim();
    } else {
      // Window already exists, get first pane ID
      const output = this.exec(
        `tmux list-panes -t "${this.sessionName}:${windowName}" -F "#{pane_id}" | head -1`
      );
      firstPaneId = output.trim();
    }

    // Get window index
    const windows = this.listWindows();
    const window = windows.find(w => w.name === windowName);
    return { windowIndex: window?.index ?? 0, firstPaneId };
  }

  switchToWindow(windowName: string): void {
    if (!this.hasWindow(windowName)) {
      throw new Error(`Window '${windowName}' not found`);
    }

    const windows = this.listWindows();
    const window = windows.find(w => w.name === windowName);
    
    if (window) {
      // Send switch command to all clients
      this.exec(`tmux send-keys -t "${this.sessionName}" C-b ${window.index}`);
    }
  }

  splitPane(windowName: string, workingDirectory: string, vertical: boolean = false): string {
    if (!this.hasWindow(windowName)) {
      throw new Error(`Window '${windowName}' not found`);
    }

    const splitFlag = vertical ? '-v' : '-h';
    const output = this.exec(
      `tmux split-window ${splitFlag} -t "${this.sessionName}:${windowName}" -c "${workingDirectory}" -P -F "#{pane_id}"`
    );
    
    return output.trim();
  }

  closeWindow(windowName: string): void {
    if (!this.hasWindow(windowName)) return;

    this.exec(`tmux kill-window -t "${this.sessionName}:${windowName}"`);
  }

  sendKeys(target: string, keys: string): void {
    this.exec(`tmux send-keys -t "${target}" "${keys}"`);
  }

  sendEnter(target: string): void {
    this.exec(`tmux send-keys -t "${target}" Enter`);
  }

  private buildClaudeCommand(instanceName?: string): string {
    if (instanceName) {
      // Use single quotes around the name so inner spaces survive tmux send-keys double-quoting
      const escaped = instanceName.replace(/'/g, "'\\''");
      return `claude --name '${escaped}'`;
    }
    return 'claude';
  }

  private applyPaneIdentity(paneId: string, config?: ClaudeInstanceConfig): void {
    if (!config) return;
    if (config.instanceName) {
      const title = config.instanceName.replace(/'/g, "'\\''");
      this.execSilent(`tmux select-pane -t "${paneId}" -T '${title}'`);
    }
    if (config.color) {
      this.execSilent(`tmux select-pane -t "${paneId}" -P 'fg=${config.color},bg=default'`);
    }
  }

  launchClaude(windowName: string, workingDirectory: string, _issueNumber: string, config?: ClaudeInstanceConfig): string {
    const { firstPaneId } = this.createWindow(windowName, workingDirectory);
    this.applyPaneIdentity(firstPaneId, config);

    this.sendKeys(firstPaneId, this.buildClaudeCommand(config?.instanceName));
    this.sendEnter(firstPaneId);

    console.log(chalk.gray('Waiting for Claude to initialize...'));
    setTimeout(() => {
      this.sendKeys(firstPaneId, 'Solve the issue described in CLAUDE.md');
      setTimeout(() => {
        this.sendEnter(firstPaneId);
        console.log(chalk.green('✓ Sent solve command to Claude'));
      }, 1000);
    }, 5000);

    return firstPaneId;
  }

  launchClaudeWithPrompt(windowName: string, workingDirectory: string, prompt: string, config?: ClaudeInstanceConfig): string {
    const { firstPaneId } = this.createWindow(windowName, workingDirectory);
    this.applyPaneIdentity(firstPaneId, config);

    this.sendKeys(firstPaneId, this.buildClaudeCommand(config?.instanceName));
    this.sendEnter(firstPaneId);

    console.log(chalk.gray('Waiting for Claude to initialize...'));
    setTimeout(() => {
      this.sendKeys(firstPaneId, prompt);
      setTimeout(() => {
        this.sendEnter(firstPaneId);
        console.log(chalk.green('✓ Sent prompt to Claude (Worker 1)'));
      }, 1000);
    }, 5000);

    return firstPaneId;
  }

  launchClaudeInPane(
    windowName: string,
    workingDirectory: string,
    _issueNumber: string,
    vertical: boolean = false,
    config?: ClaudeInstanceConfig
  ): string {
    const paneId = this.splitPane(windowName, workingDirectory, vertical);
    this.applyPaneIdentity(paneId, config);

    this.sendKeys(paneId, this.buildClaudeCommand(config?.instanceName));
    this.sendEnter(paneId);

    console.log(chalk.gray('Waiting for Claude to initialize...'));
    setTimeout(() => {
      this.sendKeys(paneId, 'Solve the issue described in CLAUDE.md');
      setTimeout(() => {
        this.sendEnter(paneId);
        console.log(chalk.green('✓ Sent solve command to Claude'));
      }, 1000);
    }, 5000);

    return paneId;
  }

  launchClaudeInPaneWithPrompt(
    windowName: string,
    workingDirectory: string,
    prompt: string,
    vertical: boolean = false,
    workerNumber?: number,
    config?: ClaudeInstanceConfig
  ): string {
    const paneId = this.splitPane(windowName, workingDirectory, vertical);
    this.applyPaneIdentity(paneId, config);

    this.sendKeys(paneId, this.buildClaudeCommand(config?.instanceName));
    this.sendEnter(paneId);

    console.log(chalk.gray('Waiting for Claude to initialize...'));
    setTimeout(() => {
      this.sendKeys(paneId, prompt);
      setTimeout(() => {
        this.sendEnter(paneId);
        const workerInfo = workerNumber === 0 ? ' (Overseer)' : workerNumber ? ` (Worker ${workerNumber})` : '';
        console.log(chalk.green(`✓ Sent prompt to Claude${workerInfo}`));
      }, 1000);
    }, 5000);

    return paneId;
  }

  selectLayout(windowName: string, layout: string): void {
    if (!this.hasWindow(windowName)) return;
    this.execSilent(`tmux select-layout -t "${this.sessionName}:${windowName}" ${layout}`);
  }

  countPanes(windowName: string): number {
    if (!this.hasWindow(windowName)) return 0;
    try {
      const output = this.exec(`tmux list-panes -t "${this.sessionName}:${windowName}" -F "#{pane_id}"`);
      return output.split('\n').filter(Boolean).length;
    } catch {
      return 0;
    }
  }

  listPaneIds(windowName: string): string[] {
    if (!this.hasWindow(windowName)) return [];
    try {
      const output = this.exec(`tmux list-panes -t "${this.sessionName}:${windowName}" -F "#{pane_id}"`);
      return output.split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  broadcastToPane(paneId: string, message: string): void {
    this.sendKeys(paneId, message);
    this.sendEnter(paneId);
  }

  openITerm(windowIndex: number, mode: 'window' | 'tab' | 'current' = 'window', focus: boolean = true): void {
    const isNewSession = !existsSync(this.markerFile);
    const activate = focus ? 'activate' : '';
    const attachCmd = `tmux attach -t ${this.sessionName}`;

    if (isNewSession) {
      writeFileSync(this.markerFile, '');

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

      const script = `
        tell application "iTerm"
          ${activate}
          ${openStep}
          tell current session of current window
            write text "${attachCmd}"
            delay 0.5
            write text "${windowIndex}"
          end tell
        end tell
      `;

      execSync(`osascript -e '${script}'`);
    } else {
      if (focus) {
        execSync(`osascript -e 'tell application "iTerm" to activate'`);
      }
      this.sendKeys(this.sessionName, `C-b ${windowIndex}`);
    }
  }

  cleanupMarkerFile(): void {
    if (existsSync(this.markerFile)) {
      unlinkSync(this.markerFile);
    }
  }
}