import { Client } from '@notionhq/client';
import { PageObjectResponse, DatabaseObjectResponse } from '@notionhq/client/build/src/api-endpoints';

interface SessionData {
  id: string;
  name: string;
  status: string;
  githubBranch?: string;
  githubPR?: number;
  tasks: string[];
  lastHeartbeat: number;
}

interface TaskData {
  id: string;
  name: string;
  status: string;
  sessionId?: string;
  priority: number;
  dependencies: string[];
  githubIssue?: number;
}

export class NotionSyncManager {
  private notion: Client;
  private databaseId: string;
  private sessionsDatabase: string;
  private tasksDatabase: string;

  constructor(config: {
    notionToken: string;
    mainDatabaseId: string;
    sessionsDatabaseId: string;
    tasksDatabaseId: string;
  }) {
    this.notion = new Client({ auth: config.notionToken });
    this.databaseId = config.mainDatabaseId;
    this.sessionsDatabase = config.sessionsDatabaseId;
    this.tasksDatabase = config.tasksDatabaseId;
  }

  async createSessionDashboard(session: SessionData): Promise<string> {
    const page = await this.notion.pages.create({
      parent: { database_id: this.sessionsDatabase },
      icon: {
        type: 'emoji',
        emoji: session.status === 'active' ? '🟢' : '🔴'
      },
      properties: {
        'Name': {
          title: [{
            text: { content: session.name }
          }]
        },
        'Session ID': {
          rich_text: [{
            text: { content: session.id }
          }]
        },
        'Status': {
          select: {
            name: session.status
          }
        },
        'GitHub Branch': {
          rich_text: session.githubBranch ? [{
            text: { content: session.githubBranch }
          }] : []
        },
        'GitHub PR': {
          number: session.githubPR || null
        },
        'Last Heartbeat': {
          date: {
            start: new Date(session.lastHeartbeat).toISOString()
          }
        },
        'Active Tasks': {
          number: session.tasks.length
        }
      },
      children: [
        {
          object: 'block',
          type: 'heading_1',
          heading_1: {
            rich_text: [{
              text: { content: `Session: ${session.name}` }
            }]
          }
        },
        {
          object: 'block',
          type: 'divider',
          divider: {}
        },
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{
              text: { content: '📊 Real-Time Metrics' }
            }]
          }
        },
        {
          object: 'block',
          type: 'synced_block',
          synced_block: {
            synced_from: null,
            children: [
              {
                object: 'block',
                type: 'callout',
                callout: {
                  rich_text: [{
                    text: { content: 'Session metrics will be updated in real-time' }
                  }],
                  icon: { emoji: '📈' }
                }
              }
            ]
          }
        },
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{
              text: { content: '🔄 GitHub Integration' }
            }]
          }
        },
        {
          object: 'block',
          type: 'embed',
          embed: {
            url: session.githubBranch
              ? `https://github.com/${process.env.GITHUB_REPO}/tree/${session.githubBranch}`
              : 'https://github.com'
          }
        },
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{
              text: { content: '📝 Active Tasks' }
            }]
          }
        },
        {
          object: 'block',
          type: 'child_database',
          child_database: {
            title: 'Session Tasks'
          }
        }
      ]
    });

    return page.id;
  }

  async updateSessionStatus(
    pageId: string,
    session: Partial<SessionData>
  ): Promise<void> {
    const updates: any = {};

    if (session.status !== undefined) {
      updates['Status'] = {
        select: { name: session.status }
      };
    }

    if (session.lastHeartbeat !== undefined) {
      updates['Last Heartbeat'] = {
        date: {
          start: new Date(session.lastHeartbeat).toISOString()
        }
      };
    }

    if (session.tasks !== undefined) {
      updates['Active Tasks'] = {
        number: session.tasks.length
      };
    }

    await this.notion.pages.update({
      page_id: pageId,
      properties: updates,
      icon: {
        type: 'emoji',
        emoji: session.status === 'active' ? '🟢' : '🔴'
      }
    });
  }

  async createTaskCard(task: TaskData): Promise<string> {
    const page = await this.notion.pages.create({
      parent: { database_id: this.tasksDatabase },
      icon: {
        type: 'emoji',
        emoji: this.getTaskEmoji(task.status)
      },
      properties: {
        'Title': {
          title: [{
            text: { content: task.name }
          }]
        },
        'Task ID': {
          rich_text: [{
            text: { content: task.id }
          }]
        },
        'Status': {
          select: {
            name: task.status
          }
        },
        'Priority': {
          select: {
            name: this.getPriorityLabel(task.priority)
          }
        },
        'Assigned Session': {
          rich_text: task.sessionId ? [{
            text: { content: task.sessionId }
          }] : []
        },
        'GitHub Issue': {
          number: task.githubIssue || null
        },
        'Dependencies': {
          multi_select: task.dependencies.map(dep => ({ name: dep }))
        }
      }
    });

    return page.id;
  }

  async createCoordinationDashboard(): Promise<string> {
    const page = await this.notion.pages.create({
      parent: { database_id: this.databaseId },
      icon: { type: 'emoji', emoji: '🎯' },
      cover: {
        type: 'external',
        external: {
          url: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0'
        }
      },
      properties: {
        'Title': {
          title: [{
            text: { content: 'Cross-Session Coordination Dashboard' }
          }]
        },
        'Type': {
          select: { name: 'Dashboard' }
        },
        'Created': {
          date: {
            start: new Date().toISOString()
          }
        }
      },
      children: [
        {
          object: 'block',
          type: 'heading_1',
          heading_1: {
            rich_text: [{
              text: {
                content: '🚀 Cross-Session Coordination Center',
                annotations: { bold: true }
              }
            }]
          }
        },
        {
          object: 'block',
          type: 'callout',
          callout: {
            rich_text: [{
              text: {
                content: 'Real-time coordination between multiple Claude sessions with GitHub, Neon, and Cloudflare integration'
              }
            }],
            icon: { emoji: '💡' },
            color: 'blue_background'
          }
        },
        {
          object: 'block',
          type: 'divider',
          divider: {}
        },
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{
              text: { content: '📊 Active Sessions' }
            }]
          }
        },
        {
          object: 'block',
          type: 'child_database',
          child_database: {
            title: 'Active Sessions'
          }
        },
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{
              text: { content: '📋 Task Queue' }
            }]
          }
        },
        {
          object: 'block',
          type: 'child_database',
          child_database: {
            title: 'Global Task Queue'
          }
        },
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{
              text: { content: '🔄 GitHub Activity' }
            }]
          }
        },
        {
          object: 'block',
          type: 'synced_block',
          synced_block: {
            synced_from: null,
            children: [
              {
                object: 'block',
                type: 'embed',
                embed: {
                  url: `https://github.com/${process.env.GITHUB_REPO}/pulse`
                }
              }
            ]
          }
        },
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{
              text: { content: '🗄️ Neon Database Status' }
            }]
          }
        },
        {
          object: 'block',
          type: 'code',
          code: {
            rich_text: [{
              text: { content: 'SELECT * FROM sessions WHERE status = \'active\';' }
            }],
            language: 'sql'
          }
        },
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{
              text: { content: '⚡ Cloudflare Workers Status' }
            }]
          }
        },
        {
          object: 'block',
          type: 'table',
          table: {
            table_width: 3,
            has_column_header: true,
            has_row_header: false,
            children: [
              {
                object: 'block',
                type: 'table_row',
                table_row: {
                  cells: [
                    [{ text: { content: 'Worker' } }],
                    [{ text: { content: 'Status' } }],
                    [{ text: { content: 'Last Update' } }]
                  ]
                }
              },
              {
                object: 'block',
                type: 'table_row',
                table_row: {
                  cells: [
                    [{ text: { content: 'cross-session-sync' } }],
                    [{ text: { content: '✅ Active' } }],
                    [{ text: { content: new Date().toISOString() } }]
                  ]
                }
              }
            ]
          }
        }
      ]
    });

    return page.id;
  }

  async syncWithNeonDatabase(neonClient: any): Promise<void> {
    const sessions = await neonClient.query('SELECT * FROM sessions WHERE status = $1', ['active']);

    for (const session of sessions.rows) {
      const notionSession = await this.findSessionByID(session.id);

      if (notionSession) {
        await this.updateSessionStatus(notionSession.id, {
          status: session.status,
          lastHeartbeat: session.last_heartbeat,
          tasks: session.tasks
        });
      } else {
        const pageId = await this.createSessionDashboard({
          id: session.id,
          name: session.session_name,
          status: session.status,
          githubBranch: session.github_branch,
          githubPR: session.github_pr_number,
          tasks: session.tasks,
          lastHeartbeat: session.last_heartbeat
        });

        await neonClient.query(
          'UPDATE sessions SET notion_page_id = $1 WHERE id = $2',
          [pageId, session.id]
        );
      }
    }
  }

  async syncGitHubActions(githubOctokit: any): Promise<void> {
    const { data: runs } = await githubOctokit.actions.listWorkflowRunsForRepo({
      owner: process.env.GITHUB_OWNER,
      repo: process.env.GITHUB_REPO,
      per_page: 10
    });

    for (const run of runs.workflow_runs) {
      await this.updateGitHubActionStatus(run);
    }
  }

  private async findSessionByID(sessionId: string): Promise<PageObjectResponse | null> {
    const response = await this.notion.databases.query({
      database_id: this.sessionsDatabase,
      filter: {
        property: 'Session ID',
        rich_text: {
          equals: sessionId
        }
      }
    });

    return response.results[0] as PageObjectResponse || null;
  }

  private async updateGitHubActionStatus(run: any): Promise<void> {
    const block = {
      object: 'block' as const,
      type: 'callout' as const,
      callout: {
        rich_text: [{
          text: {
            content: `${run.name}: ${run.status} (${run.conclusion || 'in progress'})`
          }
        }],
        icon: { emoji: this.getGitHubActionEmoji(run.status, run.conclusion) },
        color: this.getGitHubActionColor(run.conclusion) as any
      }
    };
  }

  private getTaskEmoji(status: string): string {
    const emojis: Record<string, string> = {
      'pending': '⏳',
      'in_progress': '🔄',
      'completed': '✅',
      'failed': '❌',
      'blocked': '🚫'
    };
    return emojis[status] || '📝';
  }

  private getPriorityLabel(priority: number): string {
    if (priority >= 9) return 'Critical';
    if (priority >= 7) return 'High';
    if (priority >= 4) return 'Medium';
    return 'Low';
  }

  private getGitHubActionEmoji(status: string, conclusion?: string): string {
    if (status === 'completed') {
      const emojis: Record<string, string> = {
        'success': '✅',
        'failure': '❌',
        'cancelled': '🚫',
        'skipped': '⏭️'
      };
      return emojis[conclusion || ''] || '❓';
    }
    return status === 'in_progress' ? '🔄' : '⏳';
  }

  private getGitHubActionColor(conclusion?: string): string {
    const colors: Record<string, string> = {
      'success': 'green_background',
      'failure': 'red_background',
      'cancelled': 'gray_background',
      'skipped': 'yellow_background'
    };
    return colors[conclusion || ''] || 'default';
  }
}

export async function setupNotionIntegration(): Promise<NotionSyncManager> {
  const manager = new NotionSyncManager({
    notionToken: process.env.NOTION_TOKEN!,
    mainDatabaseId: process.env.NOTION_MAIN_DB!,
    sessionsDatabaseId: process.env.NOTION_SESSIONS_DB!,
    tasksDatabaseId: process.env.NOTION_TASKS_DB!
  });

  const dashboardId = await manager.createCoordinationDashboard();
  console.log(`Notion dashboard created: https://notion.so/${dashboardId.replace(/-/g, '')}`);

  return manager;
}