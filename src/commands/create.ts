import chalk from 'chalk';
import { GitOperations } from '../lib/git.js';
import { TmuxOperations } from '../lib/tmux.js';
import { ConfigManager } from '../lib/config.js';
import { getArchetypeById } from '../lib/archetypes.js';
import * as readline from 'readline';

async function promptForTopic(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(chalk.yellow('What do you want to build or change? (brief description): '), (answer) => {
      rl.close();
      resolve(answer.trim() || 'new-task');
    });
  });
}

export async function createCommand(topic?: string): Promise<void> {
  const git = new GitOperations();
  const config = new ConfigManager(git.repoRoot);
  const tmux = new TmuxOperations(config.getSessionName());

  try {
    const resolvedTopic = topic || await promptForTopic();
    const slugifiedTopic = resolvedTopic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const windowName = `guide-${slugifiedTopic}`.slice(0, 32);

    if (tmux.hasWindow(windowName)) {
      console.log(chalk.blue(`→ Switching to existing Guide session for: ${resolvedTopic}`));
      tmux.switchToWindow(windowName);
      return;
    }

    const guideArchetype = getArchetypeById('guide');
    if (!guideArchetype) {
      throw new Error('Guide archetype not found');
    }

    const provider = config.getTicketingProvider();

    const guidePrompt = buildGuidePrompt(guideArchetype.prompt, resolvedTopic, provider);

    // Launch Guide in the main repo — no worktree created yet
    console.log(chalk.blue('\nLaunching The Guide...'));
    console.log(chalk.gray(`Session: ${config.getSessionName()}`));
    console.log(chalk.gray(`Window: ${windowName}`));
    console.log(chalk.gray(`Working dir: ${git.repoRoot}`));

    tmux.launchClaudeWithPrompt(
      windowName,
      git.repoRoot,
      guidePrompt,
      { instanceName: 'The Guide', color: guideArchetype.color }
    );

    const windows = tmux.listWindows();
    const window = windows.find(w => w.name === windowName);
    if (window) {
      tmux.openITerm(window.index, config.getItermOpenMode(), config.getItermFocus());
    }

    console.log(chalk.green('\n✓ The Guide is ready.'));
    console.log(chalk.gray('Once The Guide creates a ticket and calls `wt open <id>`, the worktree will be created automatically.'));

  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

function buildGuidePrompt(basePrompt: string, topic: string, provider: string): string {
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
