import chalk from 'chalk';
import { LinearClient } from '@linear/sdk';
import { TicketIssue, TicketOperations, TicketProvider } from './ticketing';

export class LinearOperations implements TicketOperations {
  public readonly provider: TicketProvider = 'linear';
  private client: LinearClient | null = null;

  private getClient(): LinearClient | null {
    if (this.client) return this.client;
    const apiKey = process.env.LINEAR_API_KEY;
    if (!apiKey) {
      console.log(chalk.yellow('⚠️  LINEAR_API_KEY not set. Export it in your shell to fetch Linear issues.'));
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
