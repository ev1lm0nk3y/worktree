import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'fs';

vi.mock('fs');

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockWriteFileSync = vi.mocked(writeFileSync);

import { ConfigManager } from '../../../src/core/config.js';

function makeConfig(yaml: string): ConfigManager {
  mockExistsSync.mockImplementation((p) => String(p).endsWith('.worktree.yml'));
  mockReadFileSync.mockReturnValue(yaml as any);
  return new ConfigManager('/repo/my-project');
}

function emptyConfig(): ConfigManager {
  mockExistsSync.mockReturnValue(false);
  return new ConfigManager('/repo/my-project');
}

describe('ConfigManager — no config file', () => {
  beforeEach(() => vi.resetAllMocks());

  it('getDefaultWorkers returns 1', () => {
    expect(emptyConfig().getDefaultWorkers()).toBe(1);
  });

  it('getItermOpenMode returns window', () => {
    expect(emptyConfig().getItermOpenMode()).toBe('window');
  });

  it('getItermFocus returns true', () => {
    expect(emptyConfig().getItermFocus()).toBe(true);
  });

  it('getLayout returns undefined', () => {
    expect(emptyConfig().getLayout()).toBeUndefined();
  });

  it('getTicketingProvider defaults to github', () => {
    expect(emptyConfig().getTicketingProvider()).toBe('github');
  });

  it('exists returns false', () => {
    expect(emptyConfig().exists()).toBe(false);
  });
});

describe('ConfigManager — getProjectName', () => {
  beforeEach(() => vi.resetAllMocks());

  it('uses the name field from config when set', () => {
    expect(makeConfig('name: my-project\n').getProjectName()).toBe('my-project');
  });

  it('falls back to the repo root directory name', () => {
    expect(emptyConfig().getProjectName()).toBe('my-project');
  });
});

describe('ConfigManager — getSessionName', () => {
  beforeEach(() => vi.resetAllMocks());

  it('uses session field from config when set', () => {
    expect(makeConfig('session: custom_session\n').getSessionName()).toBe('custom_session');
  });

  it('derives session name from project name when not set', () => {
    expect(makeConfig('name: My Project\n').getSessionName()).toBe('my_project_workers');
  });
});

describe('ConfigManager — getWorktreeSessionName', () => {
  beforeEach(() => vi.resetAllMocks());

  it('includes the issue number', () => {
    expect(makeConfig('name: my-tool\n').getWorktreeSessionName('123')).toContain('123');
  });

  it('slug-cases the project name', () => {
    expect(makeConfig('name: My Tool\n').getWorktreeSessionName('1')).toMatch(/^my-tool-/);
  });
});

describe('ConfigManager — getDefaultWorkers', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns configured value when within 1–5', () => {
    expect(makeConfig('workers: 3\n').getDefaultWorkers()).toBe(3);
  });

  it('clamps values above 5 to 1', () => {
    expect(makeConfig('workers: 10\n').getDefaultWorkers()).toBe(1);
  });

  it('clamps zero to 1', () => {
    expect(makeConfig('workers: 0\n').getDefaultWorkers()).toBe(1);
  });
});

describe('ConfigManager — getLayout', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns a valid layout', () => {
    expect(makeConfig('layout: tiled\n').getLayout()).toBe('tiled');
  });

  it('returns undefined for an invalid layout value', () => {
    expect(makeConfig('layout: invalid\n').getLayout()).toBeUndefined();
  });
});

describe('ConfigManager — getItermOpenMode', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns tab when configured', () => {
    expect(makeConfig('iterm:\n  open: tab\n').getItermOpenMode()).toBe('tab');
  });

  it('returns current when configured', () => {
    expect(makeConfig('iterm:\n  open: current\n').getItermOpenMode()).toBe('current');
  });

  it('falls back to window for unknown value', () => {
    expect(makeConfig('iterm:\n  open: unknown\n').getItermOpenMode()).toBe('window');
  });
});

describe('ConfigManager — getItermFocus', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns false when explicitly set to false', () => {
    expect(makeConfig('iterm:\n  focus: false\n').getItermFocus()).toBe(false);
  });

  it('returns true when explicitly set to true', () => {
    expect(makeConfig('iterm:\n  focus: true\n').getItermFocus()).toBe(true);
  });
});

describe('ConfigManager — getTicketingProvider', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns linear when configured', () => {
    expect(makeConfig('ticketing: linear\n').getTicketingProvider()).toBe('linear');
  });

  it('returns github for any other value', () => {
    expect(makeConfig('ticketing: github\n').getTicketingProvider()).toBe('github');
  });
});

describe('ConfigManager — detectCommands from package.json', () => {
  beforeEach(() => vi.resetAllMocks());

  it('detects dev, test, lint, and build scripts', () => {
    mockExistsSync.mockImplementation((p) => String(p).endsWith('package.json'));
    mockReadFileSync.mockReturnValue(JSON.stringify({
      scripts: { dev: 'vite', test: 'vitest run', lint: 'eslint .', build: 'tsc' },
    }) as any);

    const commands = new ConfigManager('/repo/my-project').getCommands();
    expect(commands?.dev).toBe('npm run dev');
    expect(commands?.test).toBe('npm test');
    expect(commands?.lint).toBe('npm run lint');
    expect(commands?.build).toBe('npm run build');
  });

  it('uses npm start as dev when only start is defined', () => {
    mockExistsSync.mockImplementation((p) => String(p).endsWith('package.json'));
    mockReadFileSync.mockReturnValue(JSON.stringify({ scripts: { start: 'node index.js' } }) as any);
    expect(new ConfigManager('/repo/my-project').getCommands()?.dev).toBe('npm start');
  });
});

describe('ConfigManager — detectCommands from Cargo.toml', () => {
  beforeEach(() => vi.resetAllMocks());

  it('detects cargo commands when Cargo.toml exists', () => {
    mockExistsSync.mockImplementation((p) => String(p).endsWith('Cargo.toml'));
    const commands = new ConfigManager('/repo/my-project').getCommands();
    expect(commands?.dev).toBe('cargo run');
    expect(commands?.test).toBe('cargo test');
    expect(commands?.build).toBe('cargo build');
  });
});

describe('ConfigManager — setTicketingProvider', () => {
  beforeEach(() => vi.resetAllMocks());

  it('writes the updated config with the new provider', () => {
    mockExistsSync.mockReturnValue(false);
    const cm = new ConfigManager('/repo/my-project');
    cm.setTicketingProvider('linear');

    expect(mockWriteFileSync).toHaveBeenCalledOnce();
    const written = mockWriteFileSync.mock.calls[0][1] as string;
    expect(written).toContain('linear');
  });
});
