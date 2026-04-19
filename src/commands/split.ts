import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync, spawn } from 'child_process';
import chalk from 'chalk';
import * as prompt from '../services/prompt';

export interface SplitOptions {
  archetype?: string;
  vertical?: boolean;
}

const ARCHETYPES = {
  architect: {
    name: 'The Architect',
    emoji: '🏗️',
    description: 'System design & architecture patterns',
  },
  detective: {
    name: 'The Detective',
    emoji: '🔍',
    description: 'Debugging, edge cases & security',
  },
  craftsman: {
    name: 'The Craftsman',
    emoji: '🛠️',
    description: 'Code quality & best practices',
  },
  explorer: {
    name: 'The Explorer',
    emoji: '🚀',
    description: 'Innovation & alternative approaches',
  },
  aesthete: {
    name: 'The Aesthete',
    emoji: '🎨',
    description: 'Elegant solutions & simplicity',
  },
};

export async function handleSplit(args: string[], options: SplitOptions) {
  try {
    const ticketInput = args[0];

    if (!ticketInput || !ticketInput.match(/^(LIN-?)?\d+$/i)) {
      console.error(
        chalk.red('❌ Please provide a Linear ticket (e.g., LIN-123)')
      );
      process.exit(1);
    }

    const ticketNumber = ticketInput
      .toUpperCase()
      .replace(/^LIN-/, '');
    const normalizedTicket = `LIN-${ticketNumber}`;

    console.log(chalk.blue(`\n🔀 Creating new worker for ${normalizedTicket}\n`));

    // Detect environment
    const isInTmux = !!process.env.TMUX;
    const isIterm2 = process.env.TERM_PROGRAM === 'iTerm.app';

    if (isInTmux) {
      await splitTmuxPane(normalizedTicket, options);
    } else if (isIterm2) {
      await splitIterm2Window(normalizedTicket, options);
    } else {
      console.error(chalk.red('❌ Must be running in tmux or iTerm2'));
      process.exit(1);
    }

    console.log(chalk.green(`✓ New worker created`));
    if (options.archetype) {
      console.log(chalk.gray(`  Archetype: ${options.archetype}`));
    }
    console.log();
  } catch (error) {
    console.error(chalk.red(`Error creating worker: ${error.message}`));
    process.exit(1);
  }
}

async function splitTmuxPane(
  ticketNumber: string,
  options: SplitOptions
): Promise<void> {
  const tmuxPane = process.env.TMUX_PANE;
  if (!tmuxPane) {
    throw new Error('Not running in a tmux pane');
  }

  // Get session and window from pane
  const sessionInfo = execSync(`tmux display-message -p '#{session_name}:#{window_index}'`)
    .toString()
    .trim();

  const splitDirection = options.vertical ? '-v' : '-h';
  const workingDir = process.cwd();

  // Split the pane
  try {
    execSync(`tmux split-window ${splitDirection} -t ${sessionInfo} -c "${workingDir}"`, {
      stdio: 'pipe',
    });
    console.log(chalk.green(`  ✓ Split tmux pane (${splitDirection === '-v' ? 'vertical' : 'horizontal'})`));
  } catch (error) {
    throw new Error(`Failed to split pane: ${error.message}`);
  }

  // Determine archetype
  let selectedArchetype = options.archetype;
  if (!selectedArchetype) {
    selectedArchetype = await promptForArchetype();
  }

  // Validate archetype
  if (!isValidArchetype(selectedArchetype)) {
    console.warn(chalk.yellow(`⚠️  Invalid archetype: ${selectedArchetype}`));
    selectedArchetype = await promptForArchetype();
  }

  // Build and send Claude command
  const claudeCommand = buildClaudeCommand(selectedArchetype);
  const newPaneId = execSync(
    `tmux display-message -p '#{pane_id}' | tail -1`
  )
    .toString()
    .trim();

  execSync(`tmux send-keys -t ${newPaneId} "${claudeCommand}" Enter`, {
    stdio: 'pipe',
  });

  console.log(chalk.green(`  ✓ Launched Claude with ${selectedArchetype}`));

  // Update coordination doc
  updateCoordinationDoc(workingDir, ticketNumber, selectedArchetype);
}

async function splitIterm2Window(
  ticketNumber: string,
  options: SplitOptions
): Promise<void> {
  const workingDir = process.cwd();

  // Determine archetype
  let selectedArchetype = options.archetype;
  if (!selectedArchetype) {
    selectedArchetype = await promptForArchetype();
  }

  if (!isValidArchetype(selectedArchetype)) {
    console.warn(chalk.yellow(`⚠️  Invalid archetype: ${selectedArchetype}`));
    selectedArchetype = await promptForArchetype();
  }

  // Use AppleScript to create new tab/pane
  const applescript = `
    tell application "iTerm"
      tell current window
        create tab with default profile
        tell current session
          delay 0.1
          write text "cd '${workingDir}'"
        end tell
      end tell
    end tell
  `;

  try {
    execSync(`osascript -e '${applescript.replace(/'/g, "'\\''")}'`, {
      stdio: 'pipe',
    });
    console.log(chalk.green(`  ✓ Created iTerm2 tab`));
  } catch (error) {
    throw new Error(`Failed to create iTerm2 tab: ${error.message}`);
  }

  // Build Claude command
  const claudeCommand = buildClaudeCommand(selectedArchetype);

  // Send command to new tab
  const commandScript = `
    tell application "iTerm"
      tell current session of current window
        write text "${claudeCommand}"
      end tell
    end tell
  `;

  try {
    execSync(`osascript -e '${commandScript.replace(/'/g, "'\\''")}'`, {
      stdio: 'pipe',
    });
    console.log(chalk.green(`  ✓ Launched Claude with ${selectedArchetype}`));
  } catch (error) {
    console.warn(
      chalk.yellow(
        `⚠️  Could not auto-launch Claude. Run: ${claudeCommand}`
      )
    );
  }

  // Update coordination doc
  updateCoordinationDoc(workingDir, ticketNumber, selectedArchetype);
}

async function promptForArchetype(): Promise<string> {
  console.log(chalk.gray('Select archetype for this worker:\n'));

  const entries = Object.entries(ARCHETYPES);
  entries.forEach(([key, arch], i) => {
    console.log(`  ${i + 1}) ${arch.emoji} ${arch.name}`);
    console.log(`     ${arch.description}`);
  });

  console.log();
  const choice = await prompt.promptUser(
    `Choice (1-${entries.length}): `
  );

  const index = parseInt(choice) - 1;
  if (index < 0 || index >= entries.length) {
    console.warn(chalk.yellow('Invalid choice. Using default: detective'));
    return 'detective';
  }

  return entries[index][0];
}

function isValidArchetype(archetype: string): boolean {
  return archetype in ARCHETYPES;
}

function buildClaudeCommand(archetype: string): string {
  return `claude --archetype ${archetype}`;
}

function updateCoordinationDoc(
  worktreePath: string,
  ticketNumber: string,
  archetype: string
): void {
  const coordFile = path.join(worktreePath, 'WORKTREE_COORDINATION.md');

  if (!fs.existsSync(coordFile)) {
    // Create it if it doesn't exist
    const initialContent = `# Worktree Coordination: ${ticketNumber}

**Created:** ${new Date().toISOString()}
**Active Workers:** 1

## Worker Assignments

### Worker 1
- **Status:** Active
- **Archetype:** ${archetype}
- **Tasks:**
  - [ ] Understanding the problem
- **Last Update:** ${new Date().toLocaleTimeString()}
- **Blockers:** None

## How to Collaborate

1. Update your status regularly
2. List tasks you're working on
3. Check other workers' tasks before starting something
4. Report blockers here

## Shared Context

See **CLAUDE.md** for full ticket details.
`;
    fs.writeFileSync(coordFile, initialContent.trim());
    return;
  }

  // Read existing content
  let content = fs.readFileSync(coordFile, 'utf-8');

  // Count existing workers
  const workerMatches = content.match(/### Worker \d+/g) || [];
  const newWorkerNumber = workerMatches.length + 1;

  // Update active worker count in header
  content = content.replace(
    /\*\*Active Workers:\*\* \d+/,
    `**Active Workers:** ${newWorkerNumber}`
  );

  // Add new worker section
  const newWorkerSection = `
### Worker ${newWorkerNumber}
- **Status:** Starting
- **Archetype:** ${archetype}
- **Tasks:**
  - [ ] Understanding the problem
- **Last Update:** ${new Date().toLocaleTimeString()}
- **Blockers:** None
`;

  // Insert before "How to Collaborate" section
  const insertPoint = content.indexOf('## How to Collaborate');
  if (insertPoint > -1) {
    content =
      content.substring(0, insertPoint) +
      newWorkerSection +
      '\n' +
      content.substring(insertPoint);
  } else {
    content += newWorkerSection;
  }

  fs.writeFileSync(coordFile, content);
}

// Export for testing
export { ARCHETYPES, isValidArchetype, buildClaudeCommand };
