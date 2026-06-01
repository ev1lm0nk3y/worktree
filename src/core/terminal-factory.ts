import { ITerminalManager } from './interfaces.js';
import { TmuxOperations } from '../lib/tmux.js';
import { VSCodeTerminalManager } from './vscode-terminal.js';

export function getTerminalManager(sessionName: string): ITerminalManager {
  // Detect VSCode
  if (process.env.TERM_PROGRAM === 'vscode' || process.env.VSCODE_GIT_ASKPASS_NODE) {
    return new VSCodeTerminalManager();
  }

  // Fallback to Tmux
  return new TmuxOperations(sessionName);
}
