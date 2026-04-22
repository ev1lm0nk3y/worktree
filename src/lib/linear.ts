import chalk from 'chalk';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import os from 'os';
import { LinearClient } from '@linear/sdk';
import { TicketIssue, TicketOperations, TicketProvider } from './ticketing.js';

function loadLinearApiKeyFromFile(): string | null {
  const envFile = path.join(os.homedir(), '.local', 'state', 'linear', 'env');
  if (!existsSync(envFile)) return null;
  try {
    const content = readFileSync(envFile, 'utf8');
    const match = content.match(/^\s*(?:export\s+)?LINEAR_API_KEY\s*=\s*["']?([^"'\n]+?)["']?\s*$/m);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

export class LinearOperations implements TicketOperations {
  public readonly provider: TicketProvider = 'linear';
  private client: LinearClient | null = null;

  private getClient(): LinearClient | null {
    if (this.client) return this.client;
    const apiKey = process.env.LINEAR_API_KEY || loadLinearApiKeyFromFile();
    if (!apiKey) {
      console.log(chalk.yellow('⚠️  LINEAR_API_KEY not set and no cached key at ~/.local/state/linear/env. Run `wt init` to set one.'));
      return null;
    }
    this.client = new LinearClient({ apiKey });
    return this.client;
  }

  async fetchIssue(id: string): Promise<TicketIssue | null> {
    const client = this.getClient();
    if (!client) return null;

    try {
      const issue = await client.issue(id);
      const [state, assignee, labelConnection] = await Promise.all([
        issue.state,
        issue.assignee,
        issue.labels()
      ]);

      return {
        identifier: issue.identifier,
        title: issue.title,
        body: issue.description || '',
        labels: labelConnection.nodes.map(l => l.name),
        state: state?.name || 'unknown',
        assignee: assignee?.displayName || assignee?.name,
        url: issue.url
      };
    } catch (error: any) {
      console.log(chalk.yellow(`⚠️  Could not fetch Linear issue ${id}: ${error.message}`));
      return null;
    }
  }
}
