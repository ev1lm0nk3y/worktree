import { writeFileSync, existsSync, appendFileSync } from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { GitOperations } from './git.js';
import { ConfigManager } from './config.js';
import { ILogger, ITerminalManager, ClaudeInstanceConfig } from './interfaces.js';
import { getTicketOperations } from './ticketing.js';
import { generateWorktreeTicket, ensureGitignore } from '../templates/claude.md.js';
import { generateCoordinationMd, generateWorkerPrompt, generateNewWorkerEntry, generateAdversaryAlert, generateAdversaryBroadcast } from '../templates/coordination.md.js';
import { generateOverseerMd, generateOverseerPrompt } from '../templates/overseer.md.js';
import { Archetype, getArchetypeById, getDefaultArchetypeForWorker } from './archetypes.js';
import { ArchetypePool } from './pools.js';
import { addWorker, getRegisteredPaneIds } from './worker-registry.js';

export interface OpenOptions {
  issueNumber: string;
  description?: string;
  workerCount?: number;
  watcher?: boolean;
  archetypes?: { [key: number]: Archetype };
  deployedPool?: ArchetypePool;
}

export class WorktreeEngine {
  constructor(
    private terminalFactory: (sessionName: string) => ITerminalManager,
    private logger: ILogger,
    private git: GitOperations,
    private config: ConfigManager
  ) {}

  async open(options: OpenOptions): Promise<void> {
    const { issueNumber, description, watcher, archetypes, deployedPool } = options;
    const terminal = this.terminalFactory(this.config.getWorktreeSessionName(issueNumber));
    const provider = this.config.getTicketingProvider();
    const tickets = await getTicketOperations(provider);
    const providerLabel = provider === 'linear' ? 'Linear' : 'GitHub';

    // Determine worker count
    const poolHasCoordinator = deployedPool ? deployedPool.coordinator?.enable !== false : false;
    const workerCount = options.workerCount || (deployedPool
      ? deployedPool.workers.length + (poolHasCoordinator ? 1 : 0)
      : this.config.getDefaultWorkers());

    if (workerCount < 1 || workerCount > 5) {
      throw new Error('Workers must be between 1 and 5');
    }

    if (!this.config.hasTicketingProvider()) {
      this.logger.warn(`⚠️  No "ticketing" field in .worktree.yml — defaulting to ${providerLabel}. Run \`wt init\` to change.`);
    } else {
      this.logger.info(`Ticketing provider: ${providerLabel}`);
    }
    
    // Check if worktree already exists
    const worktreePath = this.git.getWorktreePath(issueNumber, description);
    const windowName = `issue-${issueNumber}`;
    
    if (this.git.worktreeExists(worktreePath)) {
      this.logger.warn(`⚠️  Worktree already exists at: ${worktreePath}`);
      
      // Check if window exists
      if (terminal.hasWindow(windowName)) {
        this.logger.warn(`⚠️  Session for issue #${issueNumber} already exists`);
        this.logger.info('→ Switching to existing session...');
        if (terminal.openEditor) {
          terminal.openEditor(0, this.config.getItermOpenMode(), this.config.getItermFocus());
        }
        return;
      }
    } else {
      // Create worktree
      this.logger.startSpinner(`Creating worktree for issue #${issueNumber}...`);
      this.git.createWorktree(issueNumber, description);
      this.logger.stopSpinner(true, `Created worktree at: ${worktreePath}`);
    }
    
    // Fetch issue details
    this.logger.startSpinner(`Fetching issue details from ${providerLabel}...`);
    const issue = await tickets.fetchIssue(issueNumber);
    if (issue) {
      this.logger.stopSpinner(true, `Fetched issue details from ${providerLabel}`);
    } else {
      this.logger.stopSpinner(false, `${providerLabel} issue ${issueNumber} not found`);
      throw new Error(`Issue must exist on ${providerLabel} before creating a worktree`);
    }
    
    // Generate WORKTREE_TICKET.md
    const ticketContent = generateWorktreeTicket({
      issueNumber,
      branchName: this.git.createBranchName(issueNumber, description),
      issue: issue || undefined,
      provider,
      projectName: this.config.getProjectName(),
      customContext: this.config.getClaudeContext(),
      commands: this.config.getCommands()
    });

    const ticketPath = path.join(worktreePath, 'WORKTREE_TICKET.md');
    writeFileSync(ticketPath, ticketContent);
    this.logger.success('✓ Created WORKTREE_TICKET.md with issue context');
    
    const coordinationPath = path.join(worktreePath, 'WORKTREE_COORDINATION.md');
    
    if (watcher) {
      const overseerContent = generateOverseerMd({
        issueNumber,
        issueTitle: issue.title,
        timestamp: new Date().toISOString()
      });
      
      const overseerPath = path.join(worktreePath, 'OVERSEER.md');
      writeFileSync(overseerPath, overseerContent);
      this.logger.success('✓ Created OVERSEER.md for progress monitoring');
    }
    
    ensureGitignore(worktreePath);
    this.logger.success('✓ Added context files to .gitignore');
    
    // Setup commands
    const setupCommands = this.config.getSetupCommands();
    if (setupCommands.length > 0) {
      this.logger.info('\nRunning setup commands...');
      for (const command of setupCommands) {
        this.logger.startSpinner(`Running: ${command}`);
        try {
          execSync(command, { cwd: worktreePath, stdio: 'pipe' });
          this.logger.stopSpinner(true, `Completed: ${command}`);
        } catch (error: any) {
          const stderr = error.stderr ? error.stderr.toString() : error.message;
          this.logger.stopSpinner(false, `Failed: ${command}`);
          if (stderr) {
            this.logger.error(`  ${stderr.trim().split('\n').join('\n  ')}`);
          }
        }
      }
    }
    
    // Prepare Claude instances
    const workerArchetypes: { [key: number]: Archetype } = archetypes || {};
    
    if (deployedPool && workerCount > 1 && !archetypes) {
      const archetypeOffset = poolHasCoordinator ? 2 : 1;
      for (let i = 2; i <= workerCount; i++) {
        const archetypeId = deployedPool.workers[i - archetypeOffset];
        const archetype = getArchetypeById(archetypeId);
        if (archetype) {
          workerArchetypes[i] = archetype;
        }
      }
    } else if (workerCount > 1 && !archetypes) {
      // Defaults if not provided
      for (let i = 2; i <= workerCount; i++) {
        workerArchetypes[i] = getDefaultArchetypeForWorker(i);
      }
    }

    if (workerCount > 1) {
      const coordinationContent = generateCoordinationMd({
        issueNumber,
        issueTitle: issue.title,
        issueBody: issue.body,
        workerCount,
        timestamp: new Date().toISOString(),
        workerArchetypes
      });
      
      writeFileSync(coordinationPath, coordinationContent);
      this.logger.success('✓ Created WORKTREE_COORDINATION.md with worker archetypes');
    }

    // Launch Workers
    if (workerCount === 1) {
      this.logger.info('\nOpening Claude Code...');
      const prompt = `Solve the issue described in WORKTREE_TICKET.md`;
      const { firstPaneId } = await terminal.createWindow(windowName, worktreePath, { instanceName: 'Coordinator', color: 'colour39' });
      this.launchClaudeWithPrompt(terminal, firstPaneId, prompt);
      addWorker(worktreePath, issueNumber, 1, firstPaneId, 'coordinator');
    } else {
      this.logger.info(`\nOpening ${workerCount} Claude workers...`);

      // Launch Coordinator
      const worker1Prompt = generateWorkerPrompt(1, workerCount, issueNumber);
      const { firstPaneId } = await terminal.createWindow(windowName, worktreePath, { instanceName: 'Coordinator', color: 'colour39' });
      this.launchClaudeWithPrompt(terminal, firstPaneId, worker1Prompt);
      addWorker(worktreePath, issueNumber, 1, firstPaneId, 'coordinator');

      // Launch additional workers
      for (let i = 2; i <= workerCount; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const direction = i % 2 === 0 ? 'vertical' : 'horizontal';
        const archetype = workerArchetypes[i];
        const workerPrompt = generateWorkerPrompt(i, workerCount, issueNumber, archetype);

        const config: ClaudeInstanceConfig = archetype
          ? { instanceName: `${archetype.emoji} ${archetype.name}`, color: archetype.color, archetype }
          : {};

        const paneId = await terminal.splitPane(windowName, worktreePath, direction, config);
        this.launchClaudeWithPrompt(terminal, paneId, workerPrompt);
        addWorker(worktreePath, issueNumber, i, paneId, archetype?.id ?? 'unknown');
      }
    }

    // Watcher
    if (watcher || (deployedPool?.watcher?.enable === true)) {
      this.logger.info('\nSpawning Overseer worker...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      const overseerPrompt = generateOverseerPrompt(issueNumber);
      const overseerPaneId = await terminal.splitPane(windowName, worktreePath, 'vertical', { instanceName: 'Overseer', color: 'colour208' });
      this.launchClaudeWithPrompt(terminal, overseerPaneId, overseerPrompt);
      addWorker(worktreePath, issueNumber, 0, overseerPaneId, 'overseer');
    }

    const layout = this.config.getLayout();
    const totalPanes = workerCount + (watcher ? 1 : 0);
    if (layout && totalPanes > 1) {
      terminal.selectLayout(windowName, layout);
    }

    if (terminal.openEditor) {
      terminal.openEditor(0, this.config.getItermOpenMode(), this.config.getItermFocus());
    }
  }

  private launchClaudeWithPrompt(terminal: ITerminalManager, targetId: string, prompt: string) {
    terminal.runCommand(targetId, 'claude');
    setTimeout(() => {
      if (terminal.sendBuffered && terminal.sendEnter) {
        terminal.sendBuffered(targetId, prompt);
        terminal.sendEnter(targetId);
      } else {
        terminal.runCommand(targetId, prompt);
      }
    }, 5000);
  }

  async create(topic: string): Promise<void> {
    const provider = this.config.getTicketingProvider();
    const terminal = this.terminalFactory(this.config.getGuideSessionName(topic));
    const slugifiedTopic = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const windowName = `guide-${slugifiedTopic}`.slice(0, 32);

    if (terminal.hasWindow(windowName)) {
      this.logger.info(`→ Switching to existing Guide session for: ${topic}`);
      if (terminal.openEditor) {
        terminal.openEditor(0, this.config.getItermOpenMode(), this.config.getItermFocus());
      }
      return;
    }

    const guideArchetype = getArchetypeById('guide');
    if (!guideArchetype) {
      throw new Error('Guide archetype not found');
    }

    const guidePrompt = this.buildGuidePrompt(guideArchetype.prompt, topic, provider);

    this.logger.info('\nLaunching The Guide...');

    const { firstPaneId, windowIndex } = await terminal.createWindow(windowName, this.git.repoRoot, {
      instanceName: 'The Guide',
      color: guideArchetype.color,
      archetype: guideArchetype
    });

    this.launchClaudeWithPrompt(terminal, firstPaneId, guidePrompt);

    if (terminal.openEditor) {
      terminal.openEditor(windowIndex, this.config.getItermOpenMode(), this.config.getItermFocus());
    }

    this.logger.success('\n✓ The Guide is ready.');
    this.logger.info('Once The Guide creates a ticket and calls `wt open <id>`, the worktree will be created automatically.');
  }

  async split(issueNumber: string, options: { vertical?: boolean, archetype?: Archetype }): Promise<void> {
    const terminal = this.terminalFactory(this.config.getWorktreeSessionName(issueNumber));
    const windowName = `issue-${issueNumber}`;

    if (!terminal.hasWindow(windowName)) {
      throw new Error(`No terminal window '${windowName}' found.`);
    }

    const worktrees = this.git.listWorktrees();
    const match = worktrees.find(w => w.path.includes(`issue-${issueNumber}`));
    if (!match) {
      throw new Error(`No worktree found for issue ${issueNumber}.`);
    }
    const worktreePath = match.path;
    const coordinationPath = path.join(worktreePath, 'WORKTREE_COORDINATION.md');

    const archetype = options.archetype;
    const existingPaneIds = archetype?.id === 'adversary' ? getRegisteredPaneIds(worktreePath) : [];

    const paneCount = terminal.countPanes ? terminal.countPanes(windowName) : 0;
    const workerNumber = paneCount + 1;
    const vertical = options.vertical ?? (workerNumber % 2 !== 0);

    if (existsSync(coordinationPath)) {
      const isAdversary = archetype?.id === 'adversary';
      const workerEntry = generateNewWorkerEntry(workerNumber, archetype);
      const adversaryAlert = isAdversary ? generateAdversaryAlert(workerNumber) : '';
      appendFileSync(coordinationPath, workerEntry + adversaryAlert, 'utf8');
      this.logger.success(`✓ Updated WORKTREE_COORDINATION.md with Worker ${workerNumber}`);
    }

    const prompt = generateWorkerPrompt(workerNumber, workerNumber, issueNumber, archetype);

    const config: ClaudeInstanceConfig = archetype
      ? { instanceName: `${archetype.emoji} ${archetype.name}`, color: archetype.color, archetype }
      : {};

    const newPaneId = await terminal.splitPane(windowName, worktreePath, vertical ? 'vertical' : 'horizontal', config);
    this.launchClaudeWithPrompt(terminal, newPaneId, prompt);
    addWorker(worktreePath, issueNumber, workerNumber, newPaneId, archetype?.id ?? 'unknown');

    if (archetype?.id === 'adversary' && existingPaneIds.length > 0) {
      const broadcastMessage = generateAdversaryBroadcast(issueNumber);
      setTimeout(() => {
        this.logger.warn(`⚔️  Broadcasting Adversary alert to ${existingPaneIds.length} existing worker(s)...`);
        for (const paneId of existingPaneIds) {
          if (terminal.broadcastToPane) {
            terminal.broadcastToPane(paneId, broadcastMessage);
          }
        }
      }, 2000);
    }
  }

  private buildGuidePrompt(basePrompt: string, topic: string, provider: string): string {
    const ticketInstructions = provider === 'linear'
      ? [
          'To create the ticket in Linear, use the Linear MCP server tools (mcp__linear__createIssue) if available,',
          'or fall back to the Linear GraphQL API via curl using the LINEAR_API_KEY environment variable.',
          'The ticket identifier will be returned in the response (e.g. LIN-123 or ENG-42).',
        ].join(' ')
      : [
          'To create the ticket in GitHub, run: gh issue create --title "<title>" --body "<body>"',
          'The issue number will be printed on success (e.g. #42).',
        ].join(' ');

    return [
      basePrompt,
      '',
      `## Your task`,
      `Topic: ${topic}`,
      '',
      `## Workflow`,
      '1. Have a brief conversation with the user to clarify scope, acceptance criteria, and edge cases.',
      '2. Once both you and the user are satisfied with the definition, create a ticket in the project\'s ticketing system.',
      `   ${ticketInstructions}`,
      '3. After the ticket is created, ask the user one final question about how they want to staff the work:',
      '   "How should we staff this? Options:"',
      '   "  • Single worker (default) — `wt open <id>`"',
      '   "  • Multiple workers with archetype selection — `wt open <id> -w <2-5>`"',
      '   "  • A pre-configured pool — `wt open <id> --deploy-pool [researchers|coders|reviewers]`"',
      '   "  • Any of the above with an overseer — add `--watcher`"',
      '   Wait for the user\'s answer, then construct and run the appropriate `wt open` command.',
      '4. Confirm the worktree was created and tell the user the ticket ID, worktree path, and which workers were deployed.',
      '',
      'Do NOT create the worktree manually or generate a WORKTREE_COORDINATION.md yourself —',
      '`wt open` handles all of that using the ticket content you just created.',
    ].join('\n');
  }
}
