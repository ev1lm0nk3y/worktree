import { Archetype } from './archetypes.js';

export interface ClaudeInstanceConfig {
  instanceName?: string;
  color?: string;
  archetype?: Archetype;
}

export interface TerminalWindow {
  index: number;
  name: string;
  active: boolean;
  panes: number;
}

export interface ITerminalManager {
  hasSession(): boolean;
  hasWindow(windowName: string): boolean;
  listWindows(): TerminalWindow[];
  createWindow(windowName: string, workingDirectory: string, config?: ClaudeInstanceConfig): Promise<{ windowIndex: number; firstPaneId: string }>;
  splitPane(windowName: string, workingDirectory: string, direction: 'horizontal' | 'vertical', config?: ClaudeInstanceConfig): Promise<string>;
  runCommand(targetId: string, command: string): void;
  switchToWindow(windowName: string): void;
  selectLayout(windowName: string, layout: string): void;
  openEditor?(windowIndex: number, mode?: 'window' | 'tab' | 'current', focus?: boolean): void;
  countPanes?(windowName: string): number;
  broadcastToPane?(paneId: string, message: string): void;
  closeWindow(windowName: string): void;
  cleanup?(): void;
  killSession?(): void;
}

export interface ILogger {
  log(message: string): void;
  info(message: string): void;
  success(message: string): void;
  warn(message: string): void;
  error(message: string, error?: any): void;
  startSpinner(message: string): void;
  stopSpinner(success?: boolean, message?: string): void;
}
