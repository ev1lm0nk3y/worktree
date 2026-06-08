import { execSync } from 'child_process';
import { existsSync, writeFileSync, unlinkSync, readFileSync } from 'fs';
import { ITerminalManager, ClaudeInstanceConfig, TerminalWindow } from '../core/interfaces.js';

export class TmuxOperations implements ITerminalManager {
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

  listWindows(): TerminalWindow[] {
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

  async createWindow(windowName: string, workingDirectory: string, config?: ClaudeInstanceConfig): Promise<{ windowIndex: number; firstPaneId: string }> {
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

    if (config) {
      this.applyPaneIdentity(firstPaneId, config);
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

  async splitPane(windowName: string, workingDirectory: string, direction: 'horizontal' | 'vertical', config?: ClaudeInstanceConfig): Promise<string> {
    if (!this.hasWindow(windowName)) {
      throw new Error(`Window '${windowName}' not found`);
    }

    const splitFlag = direction === 'vertical' ? '-v' : '-h';
    const output = this.exec(
      `tmux split-window ${splitFlag} -t "${this.sessionName}:${windowName}" -c "${workingDirectory}" -P -F "#{pane_id}"`
    );
    
    const paneId = output.trim();
    if (config) {
      this.applyPaneIdentity(paneId, config);
    }
    return paneId;
  }

  closeWindow(windowName: string): void {
    if (!this.hasWindow(windowName)) return;

    this.exec(`tmux kill-window -t "${this.sessionName}:${windowName}"`);
  }

  runCommand(targetId: string, command: string): void {
    this.exec(`tmux send-keys -t "${targetId}" "${command}" Enter`);
  }

  sendKeys(target: string, keys: string): void {
    this.exec(`tmux send-keys -t "${target}" "${keys}"`);
  }

  sendEnter(target: string): void {
    this.exec(`tmux send-keys -t "${target}" Enter`);
  }

  // Sends arbitrary text via tmux's buffer to avoid shell escaping issues.
  // Handles backticks, newlines, and other special characters safely.
  sendBuffered(targetId: string, text: string): void {
    execSync('tmux load-buffer -', { input: text, encoding: 'utf8' });
    this.exec(`tmux paste-buffer -t "${targetId}"`);
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
    this.runCommand(paneId, message);
  }

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

  cleanup(): void {
    if (existsSync(this.markerFile)) {
      unlinkSync(this.markerFile);
    }
  }

  killSession(): void {
    this.execSilent(`tmux kill-session -t "${this.sessionName}"`);
    if (existsSync(this.markerFile)) {
      unlinkSync(this.markerFile);
    }
  }
}