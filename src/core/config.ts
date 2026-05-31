import { existsSync, readFileSync, writeFileSync } from 'fs';
import { load, dump } from 'js-yaml';
import path from 'path';
import chalk from 'chalk';
import { TicketProvider } from './ticketing.js';

export type ItermOpenMode = 'window' | 'tab' | 'current';
export type TmuxLayout = 'tiled' | 'even-horizontal' | 'even-vertical' | 'main-vertical' | 'main-horizontal';

export interface ItermConfig {
  open?: ItermOpenMode;
  focus?: boolean;
}

export interface WorktreeConfig {
  name?: string;
  session?: string;
  linear_workspace?: string;
  ticketing?: TicketProvider;
  iterm?: ItermConfig;
  layout?: TmuxLayout;
  workers?: number;
  claude_context?: string;
  commands?: {
    dev?: string;
    test?: string;
    lint?: string;
    build?: string;
    [key: string]: string | undefined;
  };
  setup_commands?: string[];
}

export class ConfigManager {
  private configPath: string;
  private config: WorktreeConfig = {};

  constructor(repoRoot: string) {
    this.configPath = path.join(repoRoot, '.worktree.yml');
    this.loadConfig();
  }

  private loadConfig(): void {
    if (existsSync(this.configPath)) {
      try {
        const content = readFileSync(this.configPath, 'utf8');
        this.config = load(content) as WorktreeConfig || {};
      } catch (error) {
        console.log(chalk.yellow('⚠️  Failed to parse .worktree.yml'));
        this.config = {};
      }
    }
  }

  getConfig(): WorktreeConfig {
    return this.config;
  }

  getProjectName(): string {
    return this.config.name || path.basename(path.dirname(this.configPath));
  }

  getSessionName(): string {
    if (this.config.session) {
      return this.config.session;
    }
    
    // Generate session name from project name
    const projectName = this.getProjectName();
    return projectName.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_workers';
  }

  getClaudeContext(): string | undefined {
    return this.config.claude_context;
  }

  getTicketingProvider(): TicketProvider {
    return this.config.ticketing === 'linear' ? 'linear' : 'github';
  }

  hasTicketingProvider(): boolean {
    return this.config.ticketing === 'github' || this.config.ticketing === 'linear';
  }

  getItermOpenMode(): ItermOpenMode {
    const mode = this.config.iterm?.open;
    return mode === 'tab' || mode === 'current' ? mode : 'window';
  }

  getItermFocus(): boolean {
    return this.config.iterm?.focus !== false;
  }

  getLayout(): TmuxLayout | undefined {
    const l = this.config.layout;
    const valid: TmuxLayout[] = ['tiled', 'even-horizontal', 'even-vertical', 'main-vertical', 'main-horizontal'];
    return l && valid.includes(l) ? l : undefined;
  }

  getDefaultWorkers(): number {
    const n = this.config.workers;
    if (typeof n === 'number' && n >= 1 && n <= 5) return n;
    return 1;
  }

  setTicketingProvider(provider: TicketProvider): void {
    this.config.ticketing = provider;
    const yamlContent = dump(this.config, {
      indent: 2,
      lineWidth: -1,
      quotingType: '"',
      forceQuotes: false
    });
    writeFileSync(this.configPath, yamlContent);
  }

  getCommands(): WorktreeConfig['commands'] {
    return this.config.commands || this.detectCommands();
  }

  getSetupCommands(): string[] {
    return this.config.setup_commands || [];
  }

  private detectCommands(): WorktreeConfig['commands'] {
    const commands: WorktreeConfig['commands'] = {};
    const repoRoot = path.dirname(this.configPath);

    // Check for package.json
    const packageJsonPath = path.join(repoRoot, 'package.json');
    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        const scripts = packageJson.scripts || {};
        
        if (scripts.dev) commands.dev = 'npm run dev';
        else if (scripts.start) commands.dev = 'npm start';
        
        if (scripts.test) commands.test = 'npm test';
        if (scripts.lint) commands.lint = 'npm run lint';
        if (scripts.build) commands.build = 'npm run build';
        
        // Check for type checking
        if (scripts.typecheck) commands.typecheck = 'npm run typecheck';
        else if (scripts['type-check']) commands.typecheck = 'npm run type-check';
        
      } catch {}
    }

    // Check for Cargo.toml
    const cargoTomlPath = path.join(repoRoot, 'Cargo.toml');
    if (existsSync(cargoTomlPath)) {
      commands.dev = 'cargo run';
      commands.test = 'cargo test';
      commands.build = 'cargo build';
      commands.lint = 'cargo clippy';
    }

    // Check for pyproject.toml or requirements.txt
    const pyprojectPath = path.join(repoRoot, 'pyproject.toml');
    const requirementsPath = path.join(repoRoot, 'requirements.txt');
    
    if (existsSync(pyprojectPath)) {
      commands.dev = 'poetry run python main.py';
      commands.test = 'poetry run pytest';
      commands.lint = 'poetry run flake8';
    } else if (existsSync(requirementsPath)) {
      commands.dev = 'python main.py';
      commands.test = 'pytest';
      commands.lint = 'flake8';
    }

    return commands;
  }

  createDefaultConfig(provider: TicketProvider = 'github'): void {
    const projectName = path.basename(path.dirname(this.configPath));
    const detectedCommands = this.detectCommands();

    const defaultConfig: WorktreeConfig = {
      name: projectName,
      session: projectName.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_workers',
      ticketing: provider,
      iterm: { open: 'window', focus: true },
      layout: 'tiled',
      workers: 1,
      claude_context: `# ${projectName}

Add project-specific context here that Claude should know about.
For example:
- Tech stack and frameworks
- Key architectural decisions
- Important files and directories
- Coding conventions
`,
      commands: detectedCommands
    };

    const yamlContent = dump(defaultConfig, {
      indent: 2,
      lineWidth: -1,
      quotingType: '"',
      forceQuotes: false
    });

    writeFileSync(this.configPath, yamlContent);
    this.config = defaultConfig;
    console.log(chalk.green(`✓ Created .worktree.yml in ${this.configPath}`));
    console.log(chalk.gray('  Customize this file to add project-specific context and commands'));
  }

  exists(): boolean {
    return existsSync(this.configPath);
  }
}