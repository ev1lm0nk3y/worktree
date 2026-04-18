export type TicketProvider = 'github' | 'linear';

export interface TicketIssue {
  identifier: string;
  title: string;
  body: string;
  labels: string[];
  state: string;
  assignee?: string;
  url: string;
}

export interface TicketOperations {
  readonly provider: TicketProvider;
  fetchIssue(id: string): Promise<TicketIssue | null>;
}

export async function getTicketOperations(provider: TicketProvider): Promise<TicketOperations> {
  if (provider === 'linear') {
    const { LinearOperations } = await import('./linear.js');
    return new LinearOperations();
  }
  const { GitHubOperations } = await import('./github.js');
  return new GitHubOperations();
}
