/**
 * Notion GUI Sync Service
 * Uses Notion databases as the visual interface for ChittyOS
 * Provides kanban boards, calendars, galleries, and automations
 */

import { Client } from '@notionhq/client';
import { NotionToMarkdown } from 'notion-to-md';

export class NotionGUISync {
  constructor(env) {
    this.notion = new Client({
      auth: env.NOTION_TOKEN,
    });

    this.n2m = new NotionToMarkdown({ notionClient: this.notion });

    // Main databases for GUI
    this.databases = {
      todos: env.NOTION_TODOS_DB_ID,
      projects: env.NOTION_PROJECTS_DB_ID,
      sessions: env.NOTION_SESSIONS_DB_ID,
      pipeline: env.NOTION_PIPELINE_DB_ID,
      conflicts: env.NOTION_CONFLICTS_DB_ID,
      analytics: env.NOTION_ANALYTICS_DB_ID,
    };

    this.env = env;
  }

  /**
   * Initialize Notion databases as GUI
   */
  async initializeGUI() {
    // Create main dashboard page
    const dashboard = await this.notion.pages.create({
      parent: { page_id: this.env.NOTION_WORKSPACE_ID },
      icon: { emoji: '🚀' },
      properties: {
        title: {
          title: [{
            text: { content: 'ChittyOS Command Center' }
          }]
        }
      },
      children: [
        {
          object: 'block',
          type: 'heading_1',
          heading_1: {
            rich_text: [{ text: { content: 'ChittyOS Universal Dashboard' } }]
          }
        },
        {
          object: 'block',
          type: 'callout',
          callout: {
            icon: { emoji: '🎯' },
            rich_text: [{
              text: {
                content: 'Real-time sync with CloudFlare Workers, GitHub, and Neon'
              }
            }]
          }
        }
      ]
    });

    // Create databases with views
    await this.createTodoDatabase();
    await this.createProjectsDatabase();
    await this.createPipelineDatabase();
    await this.createAnalyticsDatabase();

    return dashboard;
  }

  /**
   * Create Todo Database with multiple views
   */
  async createTodoDatabase() {
    const database = await this.notion.databases.create({
      parent: { page_id: this.env.NOTION_WORKSPACE_ID },
      title: [{ text: { content: '📝 Todos - Live Sync' } }],
      icon: { emoji: '📝' },
      properties: {
        'Title': {
          title: {}
        },
        'Status': {
          select: {
            options: [
              { name: 'Pending', color: 'gray' },
              { name: 'In Progress', color: 'yellow' },
              { name: 'Completed', color: 'green' },
              { name: 'Blocked', color: 'red' },
            ]
          }
        },
        'Priority': {
          select: {
            options: [
              { name: 'Critical', color: 'red' },
              { name: 'High', color: 'orange' },
              { name: 'Medium', color: 'yellow' },
              { name: 'Low', color: 'blue' },
            ]
          }
        },
        'Session ID': {
          rich_text: {}
        },
        'ChittyID': {
          rich_text: {}
        },
        'Git Branch': {
          rich_text: {}
        },
        'AI Analysis': {
          rich_text: {}
        },
        'Estimated Hours': {
          number: {
            format: 'number'
          }
        },
        'Dependencies': {
          relation: {
            database_id: this.databases.todos,
            type: 'dual_property',
            dual_property: {
              synced_property_name: 'Blocks',
              synced_property_id: 'dep_blocks'
            }
          }
        },
        'Tags': {
          multi_select: {
            options: []
          }
        },
        'Assigned To': {
          people: {}
        },
        'Due Date': {
          date: {}
        },
        'Created': {
          created_time: {}
        },
        'Updated': {
          last_edited_time: {}
        },
        'Sync Status': {
          select: {
            options: [
              { name: '✅ Synced', color: 'green' },
              { name: '🔄 Syncing', color: 'yellow' },
              { name: '⚠️ Conflict', color: 'red' },
              { name: '📤 Pending Upload', color: 'blue' },
            ]
          }
        }
      }
    });

    // Create different views
    await this.createDatabaseViews(database.id, 'todos');

    return database;
  }

  /**
   * Create multiple views for databases
   */
  async createDatabaseViews(databaseId, type) {
    const views = {
      todos: [
        { name: '📊 Kanban Board', type: 'board', groupBy: 'Status' },
        { name: '📅 Calendar', type: 'calendar', dateProperty: 'Due Date' },
        { name: '📈 Timeline', type: 'timeline', dateProperty: 'Created' },
        { name: '🎯 Priority View', type: 'table', sortBy: 'Priority' },
        { name: '🔍 Search', type: 'list', filter: true },
      ],
      projects: [
        { name: '🗂 Portfolio', type: 'gallery' },
        { name: '📊 Progress', type: 'board', groupBy: 'Stage' },
        { name: '⏰ Timeline', type: 'timeline' },
        { name: '📈 Gantt', type: 'timeline', dependencies: true },
      ],
      pipeline: [
        { name: '⚡ Live Pipeline', type: 'board', groupBy: 'Stage' },
        { name: '📊 Metrics', type: 'table' },
        { name: '🔄 Flow Diagram', type: 'board' },
      ]
    };

    // Notion API doesn't directly support creating views,
    // but we can structure the database for optimal viewing
    return views[type];
  }

  /**
   * Sync todos to Notion GUI
   */
  async syncTodosToNotion(todos) {
    const results = [];

    for (const todo of todos) {
      try {
        // Check if todo exists
        const existing = await this.findTodoByChittyID(todo.chitty_id);

        if (existing) {
          // Update existing
          const updated = await this.notion.pages.update({
            page_id: existing.id,
            properties: this.mapTodoToNotionProperties(todo),
          });
          results.push({ action: 'updated', id: updated.id });
        } else {
          // Create new
          const created = await this.notion.pages.create({
            parent: { database_id: this.databases.todos },
            properties: this.mapTodoToNotionProperties(todo),
            children: this.createTodoBlocks(todo),
          });
          results.push({ action: 'created', id: created.id });
        }
      } catch (error) {
        results.push({ action: 'error', error: error.message });
      }
    }

    // Trigger Notion automations
    await this.triggerNotionAutomations('todo_sync', results);

    return results;
  }

  /**
   * Map todo to Notion properties
   */
  mapTodoToNotionProperties(todo) {
    return {
      'Title': {
        title: [{
          text: { content: todo.content || 'Untitled Todo' }
        }]
      },
      'Status': {
        select: { name: this.mapStatus(todo.status) }
      },
      'Priority': {
        select: { name: todo.priority || 'Medium' }
      },
      'Session ID': {
        rich_text: [{
          text: { content: todo.session_id || '' }
        }]
      },
      'ChittyID': {
        rich_text: [{
          text: { content: todo.chitty_id || `CT-TODO-${Date.now()}` }
        }]
      },
      'Git Branch': {
        rich_text: [{
          text: { content: todo.git_branch || 'main' }
        }]
      },
      'AI Analysis': {
        rich_text: [{
          text: { content: todo.ai_analysis || '' }
        }]
      },
      'Estimated Hours': {
        number: todo.estimated_hours || 0
      },
      'Tags': {
        multi_select: (todo.tags || []).map(tag => ({ name: tag }))
      },
      'Due Date': todo.due_date ? {
        date: { start: todo.due_date }
      } : undefined,
      'Sync Status': {
        select: { name: '✅ Synced' }
      }
    };
  }

  /**
   * Create todo content blocks
   */
  createTodoBlocks(todo) {
    const blocks = [];

    // Description
    if (todo.description) {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{
            text: { content: todo.description }
          }]
        }
      });
    }

    // AI Insights
    if (todo.ai_insights) {
      blocks.push({
        object: 'block',
        type: 'callout',
        callout: {
          icon: { emoji: '🤖' },
          rich_text: [{
            text: { content: `AI Insights: ${todo.ai_insights}` }
          }]
        }
      });
    }

    // Subtasks
    if (todo.subtasks && todo.subtasks.length > 0) {
      blocks.push({
        object: 'block',
        type: 'to_do',
        to_do: {
          rich_text: [{
            text: { content: 'Subtasks:' }
          }],
          children: todo.subtasks.map(subtask => ({
            object: 'block',
            type: 'to_do',
            to_do: {
              rich_text: [{
                text: { content: subtask.content }
              }],
              checked: subtask.completed || false
            }
          }))
        }
      });
    }

    // Code blocks
    if (todo.code) {
      blocks.push({
        object: 'block',
        type: 'code',
        code: {
          rich_text: [{
            text: { content: todo.code }
          }],
          language: todo.language || 'javascript'
        }
      });
    }

    return blocks;
  }

  /**
   * Create Pipeline Monitoring Database
   */
  async createPipelineDatabase() {
    return await this.notion.databases.create({
      parent: { page_id: this.env.NOTION_WORKSPACE_ID },
      title: [{ text: { content: '⚡ Pipeline Monitor' } }],
      icon: { emoji: '⚡' },
      properties: {
        'Pipeline': {
          title: {}
        },
        'Stage': {
          select: {
            options: [
              { name: 'Validation', color: 'blue' },
              { name: 'Transform', color: 'yellow' },
              { name: 'Enrich', color: 'orange' },
              { name: 'Store', color: 'green' },
              { name: 'Notify', color: 'purple' },
            ]
          }
        },
        'Status': {
          select: {
            options: [
              { name: '🟢 Running', color: 'green' },
              { name: '🟡 Queued', color: 'yellow' },
              { name: '🔴 Failed', color: 'red' },
              { name: '✅ Complete', color: 'green' },
            ]
          }
        },
        'Duration (ms)': {
          number: { format: 'number' }
        },
        'Items Processed': {
          number: { format: 'number' }
        },
        'Error': {
          rich_text: {}
        },
        'Workflow ID': {
          rich_text: {}
        },
        'Timestamp': {
          date: {}
        }
      }
    });
  }

  /**
   * Real-time sync from Notion to other platforms
   */
  async syncFromNotion() {
    // Get recent changes from Notion
    const changes = await this.getRecentChanges();

    for (const change of changes) {
      // Sync to GitHub
      if (this.env.SYNC_TO_GITHUB) {
        await this.syncToGitHub(change);
      }

      // Sync to Neon
      if (this.env.SYNC_TO_NEON) {
        await this.syncToNeon(change);
      }

      // Sync to CloudFlare
      if (this.env.SYNC_TO_CF) {
        await this.syncToCloudFlare(change);
      }
    }

    return changes;
  }

  /**
   * Handle Notion webhooks for real-time updates
   */
  async handleNotionWebhook(request) {
    const event = await request.json();

    switch (event.type) {
      case 'page.updated':
        await this.handlePageUpdate(event);
        break;
      case 'page.created':
        await this.handlePageCreate(event);
        break;
      case 'database.updated':
        await this.handleDatabaseUpdate(event);
        break;
    }

    // Trigger CloudFlare workflow
    if (this.env.TODO_WORKFLOW) {
      await this.env.TODO_WORKFLOW.get(
        this.env.TODO_WORKFLOW.idFromName('sync')
      ).create({
        params: { source: 'notion', event }
      });
    }

    return new Response('OK', { status: 200 });
  }

  /**
   * Create Analytics Dashboard
   */
  async createAnalyticsDashboard() {
    const dashboard = await this.notion.pages.create({
      parent: { page_id: this.env.NOTION_WORKSPACE_ID },
      icon: { emoji: '📊' },
      properties: {
        title: {
          title: [{
            text: { content: 'ChittyOS Analytics' }
          }]
        }
      },
      children: [
        // Embed charts
        {
          object: 'block',
          type: 'embed',
          embed: {
            url: 'https://api.chitty.cc/analytics/dashboard'
          }
        },
        // Metrics callouts
        {
          object: 'block',
          type: 'callout',
          callout: {
            icon: { emoji: '📈' },
            rich_text: [{
              text: { content: 'Live metrics updated every 30 seconds' }
            }]
          }
        },
        // Sync status table
        {
          object: 'block',
          type: 'table',
          table: {
            table_width: 3,
            has_column_header: true,
            children: [
              {
                type: 'table_row',
                table_row: {
                  cells: [
                    [{ text: { content: 'Platform' } }],
                    [{ text: { content: 'Status' } }],
                    [{ text: { content: 'Last Sync' } }]
                  ]
                }
              }
            ]
          }
        }
      ]
    });

    return dashboard;
  }

  /**
   * Trigger Notion automations
   */
  async triggerNotionAutomations(type, data) {
    // Notion doesn't have direct automation API,
    // but we can trigger via database updates that activate rules

    const automation = await this.notion.pages.create({
      parent: { database_id: this.databases.pipeline },
      properties: {
        'Pipeline': {
          title: [{
            text: { content: `Automation: ${type}` }
          }]
        },
        'Stage': {
          select: { name: 'Notify' }
        },
        'Status': {
          select: { name: '✅ Complete' }
        },
        'Items Processed': {
          number: data.length
        },
        'Timestamp': {
          date: { start: new Date().toISOString() }
        }
      }
    });

    return automation;
  }

  /**
   * Find todo by ChittyID
   */
  async findTodoByChittyID(chittyId) {
    const response = await this.notion.databases.query({
      database_id: this.databases.todos,
      filter: {
        property: 'ChittyID',
        rich_text: {
          equals: chittyId
        }
      }
    });

    return response.results[0];
  }

  /**
   * Create interactive controls
   */
  async createInteractiveControls() {
    // Create control panel page with buttons (via synced blocks)
    const controls = await this.notion.pages.create({
      parent: { page_id: this.env.NOTION_WORKSPACE_ID },
      icon: { emoji: '🎮' },
      properties: {
        title: {
          title: [{
            text: { content: 'ChittyOS Controls' }
          }]
        }
      },
      children: [
        // Sync button (via checkbox that triggers automation)
        {
          object: 'block',
          type: 'to_do',
          to_do: {
            rich_text: [{
              text: { content: '🔄 Trigger Full Sync' }
            }],
            checked: false
          }
        },
        // Pipeline controls
        {
          object: 'block',
          type: 'toggle',
          toggle: {
            rich_text: [{
              text: { content: '⚡ Pipeline Controls' }
            }],
            children: [
              {
                type: 'to_do',
                to_do: {
                  rich_text: [{ text: { content: 'Run Todo Pipeline' } }],
                  checked: false
                }
              },
              {
                type: 'to_do',
                to_do: {
                  rich_text: [{ text: { content: 'Run Vector Pipeline' } }],
                  checked: false
                }
              }
            ]
          }
        }
      ]
    });

    return controls;
  }
}

// Export for CloudFlare Worker
export default {
  async fetch(request, env) {
    const gui = new NotionGUISync(env);
    const url = new URL(request.url);

    switch (url.pathname) {
      case '/init':
        return Response.json(await gui.initializeGUI());

      case '/sync/to':
        const todos = await request.json();
        return Response.json(await gui.syncTodosToNotion(todos));

      case '/sync/from':
        return Response.json(await gui.syncFromNotion());

      case '/webhook':
        return gui.handleNotionWebhook(request);

      case '/dashboard':
        return Response.json(await gui.createAnalyticsDashboard());

      case '/controls':
        return Response.json(await gui.createInteractiveControls());

      default:
        return new Response('Notion GUI Sync Service', { status: 200 });
    }
  }
};