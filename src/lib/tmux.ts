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
      // Track the tmux terminal by iTerm *session* id: iTerm's AppleScript
      // dictionary gives `id` to windows and sessions but not to tabs, so
      // reading `id of <tab>` always fails with -1728.
      let openStep: string;
      if (mode === 'tab') {
        openStep = `
          if (count of windows) = 0 then
            set targetSession to current session of (create window with default profile)
          else
            tell current window
              set targetSession to current session of (create tab with default profile)
            end tell
          end if`;
      } else if (mode === 'current') {
        openStep = `
          if (count of windows) = 0 then
            set targetSession to current session of (create window with default profile)
          else
            set targetSession to current session of current window
          end if`;
      } else {
        openStep = `
          set targetSession to current session of (create window with default profile)`;
      }

      const captureScript = `
        tell application "iTerm"
          ${activate}
          ${openStep}
          set sid to id of targetSession
          tell targetSession
            write text "${attachCmd}"
          end tell
          return sid
        end tell
      `;

      try {
        const result = execSync(`osascript -e '${captureScript}'`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
        writeFileSync(this.markerFile, result);
      } catch {
        writeFileSync(this.markerFile, '');
      }
    } else {
      const sessionId = readFileSync(this.markerFile, 'utf8').trim();

      if (sessionId) {
        // Stale markers (including the old "winId:tabId" format) fall through
        // the loop and error, which drops us into the recreate path below. That
        // error is expected, so osascript stderr is discarded.
        const switchScript = `
          tell application "iTerm"
            activate
            repeat with w in windows
              repeat with t in tabs of w
                repeat with s in sessions of t
                  if id of s is "${sessionId}" then
                    select w
                    select t
                    select s
                    return
                  end if
                end repeat
              end repeat
            end repeat
            error "tmux session window not found"
          end tell
        `;
        try {
          execSync(`osascript -e '${switchScript}'`, { stdio: 'ignore' });
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