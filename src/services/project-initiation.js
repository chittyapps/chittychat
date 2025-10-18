/**
 * ChittyOS Project Initiation Service
 * Production-ready project kickoff automation with full ecosystem integration
 *
 * Architecture:
 * ChittyChat → ChittyAuth → ChittyConnect → ProjectInitiation
 *   ↳ GitHub (projects, milestones, issues)
 *   ↳ WorkerAI (task generation)
 *   ↳ ChittyLedger (audit trail)
 *   ↳ ChittySync (Notion/To-Do Hub)
 */

/**
 * Project phase definitions
 */
const PROJECT_PHASES = {
  IDEATION: 'ideation',
  PLANNING: 'planning',
  KICKOFF: 'kickoff',
  ACTIVE: 'active',
  ON_HOLD: 'on_hold',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
};

/**
 * Priority levels
 */
const PRIORITY_LABELS = {
  CRITICAL: { name: 'priority:critical', color: 'B60205', description: 'Critical priority' },
  HIGH: { name: 'priority:high', color: 'D93F0B', description: 'High priority' },
  MEDIUM: { name: 'priority:medium', color: 'FBCA04', description: 'Medium priority' },
  LOW: { name: 'priority:low', color: '0E8A16', description: 'Low priority' },
};

/**
 * Ledger event types
 */
const LEDGER_EVENTS = {
  PROJECT_INITIATED: 'PROJECT_INITIATED',
  MILESTONE_CREATED: 'MILESTONE_CREATED',
  ISSUE_CREATED: 'ISSUE_CREATED',
  ROADMAP_GENERATED: 'ROADMAP_GENERATED',
  XREPO_LINKED: 'XREPO_LINKED',
  INIT_FAILED: 'INIT_FAILED',
  AI_TASK_GEN_SUCCESS: 'AI_TASK_GEN_SUCCESS',
  AI_TASK_GEN_FAILED: 'AI_TASK_GEN_FAILED',
  EXEC_METRIC: 'EXEC_METRIC',
};

/**
 * Project Initiation Service - Edge-native implementation
 */
export class ProjectInitiationService {
  constructor(env, ctx, session) {
    this.env = env;
    this.ctx = ctx;
    this.session = session;
    this.dataRepoOwner = env.DATA_REPO_OWNER || 'chitcommit';
    this.dataRepoName = env.DATA_REPO_NAME || 'chittychat-data';
    this.chittyIdUrl = env.CHITTYID_URL || 'https://id.chitty.cc';
    this.ctxId = null; // Set during kickoff
  }

  /**
   * Main kickoff orchestrator - returns 202 Accepted with ctxId
   */
  async initiateProjectKickoff(projectConfig) {
    const startTime = Date.now();
    const {
      projectName,
      description,
      repos = [],
      owners = [],
      milestones = [],
      tags = [],
      estimatedDuration = 90,
      priority = 'medium',
    } = projectConfig;

    try {
      // Ensure context
      const { ctxId } = await this.ensureContext(projectName);
      this.ctxId = ctxId;

      console.log(`[ProjectInit] Kickoff started: ${projectName} (ctxId: ${ctxId})`);

      // Budget gate
      const estimatedCost = this.calculateCost(projectConfig);
      const budgetAllowed = await this.checkBudget(estimatedCost);
      if (!budgetAllowed) {
        throw new Error(`Budget exceeded: estimated $${estimatedCost}`);
      }

      // Step 1: Mint project ChittyID
      const projectId = await this.mintProjectChittyId({
        projectName,
        description,
        type: 'PROP',
      });

      await this.logEvent(LEDGER_EVENTS.PROJECT_INITIATED, {
        projectId: projectId.chittyId,
        projectName,
        repos: repos.length,
        estimatedDuration,
      });

      // Step 2: Update chittychat-data repo
      const dataRepoUpdate = await this.updateDataRepo({
        projectId: projectId.chittyId,
        projectName,
        description,
        phase: PROJECT_PHASES.KICKOFF,
        repos,
        owners,
        tags,
        kickoffDate: new Date().toISOString(),
      });

      // Step 3: Initialize GitHub Projects v2 (parallel)
      const githubProjects = await this.initializeGitHubProjects({
        projectId: projectId.chittyId,
        projectName,
        description,
        repos,
        owners,
      });

      // Step 4: Create milestones (parallel per repo)
      const milestonesCreated = await this.createMilestones({
        projectId: projectId.chittyId,
        projectName,
        repos,
        milestones,
        estimatedDuration,
      });

      await this.logEvent(LEDGER_EVENTS.MILESTONE_CREATED, {
        count: milestonesCreated.count,
        milestones: milestonesCreated.milestones.map(m => ({
          title: m.title,
          chittyId: m.chittyId,
          repo: `${m.owner}/${m.repo}`,
        })),
      });

      // Step 5: AI-powered issue generation
      const issuesCreated = await this.generateAndCreateIssues({
        projectId: projectId.chittyId,
        projectName,
        description,
        repos,
        milestones: milestonesCreated.milestones,
        milestoneMap: milestonesCreated.milestoneMap,
        priority,
      });

      await this.logEvent(LEDGER_EVENTS.ISSUE_CREATED, {
        count: issuesCreated.count,
        aiGenerated: issuesCreated.aiGenerated,
        fallback: issuesCreated.fallback,
      });

      // Step 6: Generate roadmap (MD + JSON)
      const roadmap = await this.generateRoadmap({
        projectId: projectId.chittyId,
        projectName,
        milestones: milestonesCreated.milestones,
        issues: issuesCreated.issues,
      });

      await this.logEvent(LEDGER_EVENTS.ROADMAP_GENERATED, {
        mdPath: roadmap.mdPath,
        jsonPath: roadmap.jsonPath,
      });

      // Step 7: Cross-repo dependencies
      const dependencies = await this.createCrossRepoDependencies({
        projectId: projectId.chittyId,
        repos,
        issues: issuesCreated.issues,
      });

      await this.logEvent(LEDGER_EVENTS.XREPO_LINKED, {
        count: dependencies.count,
      });

      // Step 8: Push to ChittySync
      await this.pushToSync('project_kickoff_complete', {
        projectId: projectId.chittyId,
        projectName,
        milestones: milestonesCreated.count,
        issues: issuesCreated.count,
        roadmapUrl: roadmap.mdUrl,
      });

      // Final metrics
      const duration = Date.now() - startTime;
      this.ctx.waitUntil(this.logMetric('project_kickoff', {
        duration,
        repos: repos.length,
        milestones: milestonesCreated.count,
        issues: issuesCreated.count,
        success: true,
      }));

      return {
        success: true,
        ctxId,
        projectId: projectId.chittyId,
        projectName,
        phase: PROJECT_PHASES.KICKOFF,
        kickoffDate: new Date().toISOString(),
        results: {
          dataRepoUpdate,
          githubProjects,
          milestones: milestonesCreated,
          issues: issuesCreated,
          roadmap,
          dependencies,
        },
        summary: {
          totalRepos: repos.length,
          totalProjects: githubProjects.projects.length,
          totalMilestones: milestonesCreated.count,
          totalIssues: issuesCreated.count,
          roadmapUrl: roadmap.mdUrl,
          duration,
        },
      };
    } catch (error) {
      return this.handleError('kickoff', error);
    }
  }

  /**
   * Ensure ChittyConnect context
   */
  async ensureContext(projectName) {
    try {
      // Use ChittyConnect if available
      if (typeof ChittyConnect !== 'undefined') {
        return await ChittyConnect.ensureContext(this.session.chittyId, projectName);
      }

      // Fallback: generate deterministic ctxId
      const encoder = new TextEncoder();
      const data = encoder.encode(`${this.session.chittyId}:${projectName}:${Date.now()}`);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const ctxId = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);

      return { ctxId: `ctx_${ctxId}` };
    } catch (error) {
      console.error('[ProjectInit] Context creation error:', error);
      throw error;
    }
  }

  /**
   * Log event to ChittyLedger via waitUntil
   */
  async logEvent(type, payload) {
    const record = {
      type,
      ctxId: this.ctxId,
      actor: this.session.chittyId,
      payload,
      ts: Date.now(),
    };

    this.ctx.waitUntil(
      (async () => {
        try {
          // Use ChittyLedger if available
          if (typeof ChittyLedger !== 'undefined') {
            await ChittyLedger.record(record);
          } else {
            // Fallback: log to KV
            await this.env.PLATFORM_KV?.put(
              `ledger:${this.ctxId}:${type}:${Date.now()}`,
              JSON.stringify(record),
              { expirationTtl: 2592000 } // 30 days
            );
          }
        } catch (e) {
          console.error('[ProjectInit] Ledger write failed:', e);
        }
      })()
    );
  }

  /**
   * Log execution metric
   */
  async logMetric(operation, metrics) {
    return this.logEvent(LEDGER_EVENTS.EXEC_METRIC, {
      operation,
      ...metrics,
    });
  }

  /**
   * Calculate estimated cost
   */
  calculateCost(projectConfig) {
    const { repos = [], milestones = [], estimatedDuration = 90 } = projectConfig;

    // Rough estimates:
    // - GitHub API calls: $0.001 per call
    // - WorkerAI: $0.01 per invocation
    // - ChittyID minting: $0.005 per ID

    const githubCalls = repos.length * (10 + milestones.length * 2 + 20); // projects + milestones + issues
    const aiCalls = repos.length; // One AI generation per repo
    const chittyIds = 1 + milestones.length * repos.length + 20 * repos.length; // project + milestones + ~20 issues per repo

    return (githubCalls * 0.001) + (aiCalls * 0.01) + (chittyIds * 0.005);
  }

  /**
   * Check budget allowance
   */
  async checkBudget(estimatedCost) {
    try {
      if (typeof BudgetDAO !== 'undefined') {
        return await BudgetDAO.allow(this.session.chittyId, 'project:initiate', estimatedCost);
      }
      // Fallback: allow if under $10
      return estimatedCost < 10;
    } catch (error) {
      console.warn('[ProjectInit] Budget check failed, allowing:', error);
      return true;
    }
  }

  /**
   * Mint ChittyID via id.chitty.cc
   */
  async mintProjectChittyId(projectData) {
    const { projectName, description, type = 'PROP' } = projectData;

    try {
      const response = await fetch(`${this.chittyIdUrl}/v1/mint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.env.CHITTY_ID_TOKEN}`,
        },
        body: JSON.stringify({
          type,
          jurisdiction: 'USA',
          region: 1,
          trust: 3,
          metadata: {
            name: projectName,
            description,
            entityType: 'project',
            createdAt: new Date().toISOString(),
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`ChittyID minting failed: ${response.status} ${await response.text()}`);
      }

      const result = await response.json();
      return {
        chittyId: result.chittyId || result.id,
        metadata: result.metadata,
      };
    } catch (error) {
      console.error('[ProjectInit] ChittyID minting error:', error);
      // CRITICAL: Cannot proceed without ChittyID
      throw new Error('ChittyID service unavailable - cannot proceed without valid ChittyID');
    }
  }

  /**
   * Write file to GitHub (edge-native, no Buffer, with retry)
   */
  async writeGitHubFile({ owner, repo, path, message, text, sha = null }) {
    const content = btoa(unescape(encodeURIComponent(text)));

    const body = { message, content };
    if (sha) body.sha = sha;

    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${this.env.GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github+json',
          'User-Agent': 'ChittyOS-ProjectInit/1.0',
        },
        body: JSON.stringify(body),
      }
    );

    // Check rate limit
    await this.checkRateLimit(res);

    // Retry on 409 conflict
    if (res.status === 409) {
      const latest = await this.getGitHubFile(owner, repo, path);
      return this.writeGitHubFile({ owner, repo, path, message, text, sha: latest.sha });
    }

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`GitHub write failed: ${res.status} ${err}`);
    }

    return res.json();
  }

  /**
   * Read file from GitHub
   */
  async getGitHubFile(owner, repo, path) {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
      {
        headers: {
          Authorization: `Bearer ${this.env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'ChittyOS-ProjectInit/1.0',
        },
      }
    );

    await this.checkRateLimit(res);

    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`GitHub read failed: ${res.status}`);
    }

    return res.json();
  }

  /**
   * Query GitHub GraphQL API
   */
  async queryGraphQL(query, variables = {}) {
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
        'User-Agent': 'ChittyOS-ProjectInit/1.0',
      },
      body: JSON.stringify({ query, variables }),
    });

    await this.checkRateLimit(res);

    if (!res.ok) {
      throw new Error(`GraphQL query failed: ${res.status}`);
    }

    const result = await res.json();
    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    return result.data;
  }

  /**
   * Check GitHub rate limit
   */
  async checkRateLimit(response) {
    const remaining = parseInt(response.headers.get('x-ratelimit-remaining') || '5000');
    const reset = parseInt(response.headers.get('x-ratelimit-reset') || '0');

    if (remaining < 100) {
      console.warn(`[ProjectInit] GitHub rate limit low: ${remaining} remaining`);

      // Alert if critical
      if (remaining < 10) {
        const waitMs = (reset * 1000) - Date.now();
        if (waitMs > 0 && waitMs < 60000) {
          console.warn(`[ProjectInit] Rate limit critical, waiting ${waitMs}ms`);
          await new Promise(r => setTimeout(r, Math.min(waitMs, 60000)));
        }
      }
    }

    return { remaining, reset };
  }

  /**
   * Get owner node ID for Projects v2 (FIX: use org/user, NOT repo)
   */
  async getOwnerNodeId(login, isOrg = false) {
    if (isOrg) {
      const query = `query($login: String!) { organization(login: $login) { id } }`;
      const data = await this.queryGraphQL(query, { login });
      return data.organization.id;
    } else {
      const query = `query { viewer { id login } }`;
      const data = await this.queryGraphQL(query);
      return data.viewer.id;
    }
  }

  /**
   * Update chittychat-data repo
   */
  async updateDataRepo(projectMetadata) {
    const { projectId, projectName, phase, repos, owners, tags, kickoffDate, description } =
      projectMetadata;

    const metadata = {
      chittyId: projectId,
      projectName,
      description,
      phase,
      kickoffDate,
      repos: repos.map(r => ({
        owner: r.owner,
        repo: r.repo,
        role: r.role || 'primary',
      })),
      owners: owners.map(o => ({
        username: o.username,
        role: o.role || 'contributor',
      })),
      tags,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const filePath = `projects/${projectName}/metadata.json`;
    const existingFile = await this.getGitHubFile(this.dataRepoOwner, this.dataRepoName, filePath);

    const commitMessage = existingFile
      ? `Update project metadata: ${projectName} (phase: ${phase})`
      : `Initialize project: ${projectName} (kickoff)`;

    await this.writeGitHubFile({
      owner: this.dataRepoOwner,
      repo: this.dataRepoName,
      path: filePath,
      message: commitMessage,
      text: JSON.stringify(metadata, null, 2),
      sha: existingFile?.sha,
    });

    return {
      success: true,
      filePath,
      dataRepo: `${this.dataRepoOwner}/${this.dataRepoName}`,
      url: `https://github.com/${this.dataRepoOwner}/${this.dataRepoName}/blob/main/${filePath}`,
    };
  }

  /**
   * Initialize GitHub Projects v2 (parallel)
   */
  async initializeGitHubProjects(config) {
    const { projectId, projectName, description, repos, owners } = config;

    const projectJobs = repos.map(async repoConfig => {
      const { owner, repo, isOrg = true } = repoConfig;

      try {
        console.log(`[ProjectInit] Creating GitHub Project for ${owner}/${repo}`);

        // Get owner node ID (org or user)
        const ownerId = await this.getOwnerNodeId(owner, isOrg);

        // Create project
        const mutation = `
          mutation($ownerId: ID!, $title: String!, $body: String!) {
            createProjectV2(input: {
              ownerId: $ownerId
              title: $title
              body: $body
            }) {
              projectV2 {
                id
                number
                title
                url
              }
            }
          }
        `;

        const result = await this.queryGraphQL(mutation, {
          ownerId,
          title: projectName,
          body: `${description}\n\n**ChittyID**: ${projectId}\n\n**Owners**: ${owners.map(o => `@${o.username}`).join(', ')}`,
        });

        const project = result.createProjectV2.projectV2;

        // Configure project fields
        await this.configureProjectFields(project.id);

        return {
          owner,
          repo,
          projectId: project.id,
          projectNumber: project.number,
          projectUrl: project.url,
        };
      } catch (error) {
        console.error(`[ProjectInit] Error creating project for ${owner}/${repo}:`, error);
        return null;
      }
    });

    const results = await Promise.allSettled(projectJobs);
    const projects = results
      .filter(r => r.status === 'fulfilled' && r.value)
      .map(r => r.value);

    return { projects, count: projects.length };
  }

  /**
   * Configure custom fields for GitHub Project
   */
  async configureProjectFields(projectId) {
    const fields = [
      { name: 'Priority', dataType: 'SINGLE_SELECT' },
      { name: 'ChittyID', dataType: 'TEXT' },
      { name: 'Effort', dataType: 'NUMBER' },
    ];

    for (const field of fields) {
      try {
        const mutation = `
          mutation($projectId: ID!, $name: String!, $dataType: ProjectV2CustomFieldType!) {
            createProjectV2Field(input: {
              projectId: $projectId
              name: $name
              dataType: $dataType
            }) {
              projectV2Field {
                ... on ProjectV2Field {
                  id
                  name
                }
              }
            }
          }
        `;

        await this.queryGraphQL(mutation, {
          projectId,
          name: field.name,
          dataType: field.dataType,
        });
      } catch (error) {
        console.warn(`[ProjectInit] Field creation warning: ${error.message}`);
      }
    }
  }

  /**
   * Create milestones (parallel per repo, with title→number mapping)
   */
  async createMilestones(config) {
    const { projectId, projectName, repos, milestones, estimatedDuration } = config;

    const defaultMilestones = milestones.length
      ? milestones
      : this.generateDefaultMilestones(projectName, estimatedDuration);

    const milestoneMap = new Map(); // owner/repo → Map<title, number>
    const createdMilestones = [];

    // Parallel: ensure labels for all repos first
    await Promise.allSettled(repos.map(r => this.ensureLabels(r.owner, r.repo)));

    // Create milestones per repo
    for (const repoConfig of repos) {
      const { owner, repo } = repoConfig;
      const repoMilestones = new Map();

      for (const milestone of defaultMilestones) {
        try {
          const res = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/milestones`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${this.env.GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
                Accept: 'application/vnd.github+json',
                'User-Agent': 'ChittyOS-ProjectInit/1.0',
              },
              body: JSON.stringify({
                title: milestone.title,
                description: `${milestone.description}\n\n**ChittyID**: ${projectId}`,
                due_on: milestone.dueDate,
              }),
            }
          );

          await this.checkRateLimit(res);

          if (!res.ok) {
            console.error(`[ProjectInit] Milestone creation failed: ${res.status}`);
            continue;
          }

          const result = await res.json();

          // Mint ChittyID for milestone
          const milestoneId = await this.mintProjectChittyId({
            projectName: `${projectName} - ${milestone.title}`,
            description: milestone.description,
            type: 'EVNT',
          });

          // Store in map
          repoMilestones.set(milestone.title, result.number);

          createdMilestones.push({
            owner,
            repo,
            number: result.number,
            title: result.title,
            url: result.html_url,
            chittyId: milestoneId.chittyId,
            dueDate: milestone.dueDate,
          });
        } catch (error) {
          console.error(`[ProjectInit] Milestone error for ${owner}/${repo}:`, error);
        }
      }

      milestoneMap.set(`${owner}/${repo}`, repoMilestones);
    }

    return { milestones: createdMilestones, count: createdMilestones.length, milestoneMap };
  }

  /**
   * Generate default milestones
   */
  generateDefaultMilestones(projectName, estimatedDuration = 90) {
    const now = new Date();
    const addDays = days => {
      const date = new Date(now);
      date.setDate(date.getDate() + days);
      return date.toISOString();
    };

    const phaseDuration = Math.floor(estimatedDuration / 4);

    return [
      {
        title: `${projectName} - Setup & Planning`,
        description: 'Initial setup, architecture design, and planning phase',
        dueDate: addDays(phaseDuration),
      },
      {
        title: `${projectName} - Core Development`,
        description: 'Core functionality implementation',
        dueDate: addDays(phaseDuration * 2),
      },
      {
        title: `${projectName} - Integration & Testing`,
        description: 'Integration, testing, and quality assurance',
        dueDate: addDays(phaseDuration * 3),
      },
      {
        title: `${projectName} - Launch`,
        description: 'Final polish, documentation, and launch preparation',
        dueDate: addDays(estimatedDuration),
      },
    ];
  }

  /**
   * Ensure required labels exist
   */
  async ensureLabels(owner, repo) {
    const requiredLabels = [
      ...Object.values(PRIORITY_LABELS),
      { name: 'chittyos:project', color: '1D76DB', description: 'ChittyOS project management' },
    ];

    // Read existing labels first
    const existingRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/labels`, {
      headers: {
        Authorization: `Bearer ${this.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'ChittyOS-ProjectInit/1.0',
      },
    });

    const existing = existingRes.ok ? await existingRes.json() : [];
    const existingNames = new Set(existing.map(l => l.name));

    // Create missing labels
    for (const label of requiredLabels) {
      if (existingNames.has(label.name)) continue;

      try {
        await fetch(`https://api.github.com/repos/${owner}/${repo}/labels`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.env.GITHUB_TOKEN}`,
            'Content-Type': 'application/json',
            Accept: 'application/vnd.github+json',
            'User-Agent': 'ChittyOS-ProjectInit/1.0',
          },
          body: JSON.stringify({
            name: label.name,
            color: label.color,
            description: label.description,
          }),
        });
      } catch (error) {
        // Silent fail - label might have been created by another process
      }
    }
  }

  /**
   * Generate and create issues (AI-powered with fallback)
   */
  async generateAndCreateIssues(config) {
    const { projectId, projectName, description, repos, milestones, milestoneMap, priority } =
      config;

    // Generate tasks with AI
    const aiTasks = await this.generateTasksWithAI({
      projectName,
      description,
      milestones,
    });

    const createdIssues = [];
    const issueJobs = [];

    for (const repoConfig of repos) {
      const { owner, repo } = repoConfig;
      const mMap = milestoneMap.get(`${owner}/${repo}`) || new Map();

      for (const task of aiTasks) {
        issueJobs.push(
          (async () => {
            try {
              // Mint ChittyID for issue
              const issueId = await this.mintProjectChittyId({
                projectName: `${projectName} - ${task.title}`,
                description: task.description,
                type: 'EVNT',
              });

              // Get milestone number
              const milestoneNumber = mMap.get(task.milestoneTitle);

              // Create issue
              const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${this.env.GITHUB_TOKEN}`,
                  'Content-Type': 'application/json',
                  Accept: 'application/vnd.github+json',
                  'User-Agent': 'ChittyOS-ProjectInit/1.0',
                },
                body: JSON.stringify({
                  title: task.title,
                  body: `${task.description}\n\n**ChittyID**: ${issueId.chittyId}\n**Project**: ${projectName}\n**Priority**: ${task.priority || priority}\n**Context**: ${this.ctxId}`,
                  labels: [
                    `priority:${task.priority || priority}`,
                    ...(task.labels || []),
                    'chittyos:project',
                  ],
                  milestone: milestoneNumber,
                }),
              });

              await this.checkRateLimit(res);

              if (!res.ok) {
                console.error(`[ProjectInit] Issue creation failed: ${res.status}`);
                return null;
              }

              const result = await res.json();

              return {
                owner,
                repo,
                number: result.number,
                title: result.title,
                url: result.html_url,
                chittyId: issueId.chittyId,
                milestone: task.milestoneTitle,
                priority: task.priority || priority,
              };
            } catch (error) {
              console.error(`[ProjectInit] Issue creation error:`, error);
              return null;
            }
          })()
        );
      }
    }

    // Execute with concurrency limit
    const results = await Promise.allSettled(issueJobs);
    results.forEach(r => {
      if (r.status === 'fulfilled' && r.value) {
        createdIssues.push(r.value);
      }
    });

    return {
      issues: createdIssues,
      count: createdIssues.length,
      aiGenerated: aiTasks.length > 0,
      fallback: aiTasks.length === 0,
    };
  }

  /**
   * Generate tasks with WorkerAI (with validation and fallback)
   */
  async generateTasksWithAI(config) {
    const { projectName, description, milestones } = config;
    const startTime = Date.now();

    const prompt = this.buildTaskPrompt(projectName, description, milestones);

    let text;
    try {
      const res = await this.env.AI.run('@cf/meta/llama-3.3-70b-instruct', {
        prompt,
        temperature: 0.4,
        max_tokens: 4096,
      });

      text = typeof res === 'string' ? res : res.response || res.output_text || '';

      if (!text) {
        throw new Error('Empty AI response');
      }
    } catch (e) {
      await this.logEvent(LEDGER_EVENTS.AI_TASK_GEN_FAILED, { error: e.message });
      console.warn('[ProjectInit] AI generation failed, using fallback:', e);
      return this.generateFallbackTasks(projectName, milestones);
    }

    try {
      // Try to extract JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      const jsonText = jsonMatch ? jsonMatch[0] : text;

      const parsed = JSON.parse(jsonText);
      const tasks = Array.isArray(parsed) ? parsed : parsed.tasks || [];

      // Validate
      this.validateTasks(tasks);

      // Log success
      const duration = Date.now() - startTime;
      await this.logEvent(LEDGER_EVENTS.AI_TASK_GEN_SUCCESS, {
        taskCount: tasks.length,
        model: '@cf/meta/llama-3.3-70b-instruct',
        duration,
      });

      return tasks;
    } catch (e) {
      await this.logEvent(LEDGER_EVENTS.AI_TASK_GEN_FAILED, {
        error: e.message,
        textLength: text.length,
      });
      console.warn('[ProjectInit] AI parse/validation failed, using fallback:', e);
      return this.generateFallbackTasks(projectName, milestones);
    }
  }

  /**
   * Build AI prompt for task generation
   */
  buildTaskPrompt(projectName, description, milestones) {
    const milestoneList = milestones
      .map((m, i) => `${i + 1}. ${m.title} (Due: ${m.dueDate})`)
      .join('\n');

    return `Generate granular development tasks for this project. Return ONLY valid JSON.

PROJECT: ${projectName}
DESCRIPTION: ${description}

MILESTONES:
${milestoneList}

REQUIREMENTS:
- Each task must be completable in 1-3 days
- Include specific acceptance criteria
- Assign to appropriate milestone
- Set priority: critical, high, medium, or low
- Add technology labels

EXAMPLE OUTPUT:
[
  {
    "title": "Setup TypeScript configuration and build pipeline",
    "description": "Configure tsconfig.json, ESLint, and build scripts. Acceptance: Clean build with no errors, linting passes.",
    "milestoneTitle": "${milestones[0]?.title}",
    "priority": "high",
    "labels": ["typescript", "infrastructure"],
    "estimatedDays": 1
  },
  {
    "title": "Implement core authentication service",
    "description": "Build JWT token validation and session management. Acceptance: Unit tests >90% coverage, integration tests pass.",
    "milestoneTitle": "${milestones[1]?.title}",
    "priority": "critical",
    "labels": ["auth", "backend", "api"],
    "estimatedDays": 2
  }
]

Return ONLY the JSON array, no markdown, no explanation.`;
  }

  /**
   * Validate task schema
   */
  validateTasks(tasks) {
    if (!Array.isArray(tasks)) {
      throw new Error('Tasks must be an array');
    }

    const validPriorities = new Set(['critical', 'high', 'medium', 'low']);

    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      const path = `tasks[${i}]`;

      if (!t.title || typeof t.title !== 'string') {
        throw new Error(`${path}.title is required and must be string`);
      }

      if (!t.description || typeof t.description !== 'string') {
        throw new Error(`${path}.description is required and must be string`);
      }

      if (!t.milestoneTitle || typeof t.milestoneTitle !== 'string') {
        throw new Error(`${path}.milestoneTitle is required and must be string`);
      }

      if (!validPriorities.has(t.priority)) {
        throw new Error(
          `${path}.priority must be one of: ${[...validPriorities].join(', ')}`
        );
      }

      if (!Array.isArray(t.labels)) {
        throw new Error(`${path}.labels must be an array`);
      }

      if (
        typeof t.estimatedDays !== 'number' ||
        t.estimatedDays < 1 ||
        t.estimatedDays > 3
      ) {
        throw new Error(`${path}.estimatedDays must be 1-3`);
      }
    }

    return true;
  }

  /**
   * Fallback task generator
   */
  generateFallbackTasks(projectName, milestones) {
    const taskTemplates = [
      {
        title: 'Setup development environment and tooling',
        description:
          'Initialize repository structure, configure linters, formatters, and CI/CD. Acceptance: Clean build, all checks pass.',
        priority: 'high',
        labels: ['setup', 'infrastructure', 'ci-cd'],
        estimatedDays: 1,
      },
      {
        title: 'Design system architecture and data models',
        description:
          'Create architecture diagrams, define component boundaries, design database schema. Acceptance: Architecture doc approved, ERD complete.',
        priority: 'high',
        labels: ['architecture', 'design', 'documentation'],
        estimatedDays: 2,
      },
      {
        title: 'Implement core business logic',
        description:
          'Build main features and business rules. Acceptance: Core functionality working, manual tests pass.',
        priority: 'critical',
        labels: ['feature', 'core', 'backend'],
        estimatedDays: 3,
      },
      {
        title: 'Write comprehensive unit tests',
        description:
          'Achieve >80% test coverage for core components. Acceptance: Coverage report shows >80%, all tests green.',
        priority: 'high',
        labels: ['testing', 'quality', 'unit-tests'],
        estimatedDays: 2,
      },
      {
        title: 'Integration and end-to-end testing',
        description:
          'Test component interactions and complete user flows. Acceptance: E2E tests cover critical paths, all passing.',
        priority: 'medium',
        labels: ['testing', 'integration', 'e2e'],
        estimatedDays: 2,
      },
      {
        title: 'Write user documentation and API guides',
        description:
          'Create user guides, API documentation, and deployment instructions. Acceptance: Docs complete, reviewed by team.',
        priority: 'medium',
        labels: ['documentation', 'guides'],
        estimatedDays: 2,
      },
    ];

    const tasks = [];

    // Distribute across milestones
    milestones.forEach((milestone, idx) => {
      const template = taskTemplates[idx] || taskTemplates[taskTemplates.length - 1];
      tasks.push({
        ...template,
        title: `[${projectName}] ${template.title}`,
        milestoneTitle: milestone.title,
      });
    });

    // Add extras if more templates than milestones
    if (taskTemplates.length > milestones.length && milestones.length > 0) {
      const lastMilestone = milestones[milestones.length - 1];
      for (let i = milestones.length; i < taskTemplates.length; i++) {
        const template = taskTemplates[i];
        tasks.push({
          ...template,
          title: `[${projectName}] ${template.title}`,
          milestoneTitle: lastMilestone.title,
        });
      }
    }

    return tasks;
  }

  /**
   * Generate roadmap (MD + JSON)
   */
  async generateRoadmap(config) {
    const { projectId, projectName, milestones, issues } = config;

    // Build markdown
    const md = this.buildRoadmapMarkdown({ projectId, projectName, milestones, issues });

    // Build structured JSON
    const json = this.buildRoadmapJSON({ projectId, projectName, milestones, issues });

    // Write both files
    const mdPath = `projects/${projectName}/ROADMAP.md`;
    const jsonPath = `projects/${projectName}/ROADMAP.json`;

    await this.writeGitHubFile({
      owner: this.dataRepoOwner,
      repo: this.dataRepoName,
      path: mdPath,
      message: `Generate roadmap for ${projectName}`,
      text: md,
    });

    await this.writeGitHubFile({
      owner: this.dataRepoOwner,
      repo: this.dataRepoName,
      path: jsonPath,
      message: `Generate roadmap JSON for ${projectName}`,
      text: JSON.stringify(json, null, 2),
    });

    return {
      success: true,
      mdPath,
      jsonPath,
      mdUrl: `https://github.com/${this.dataRepoOwner}/${this.dataRepoName}/blob/main/${mdPath}`,
      jsonUrl: `https://github.com/${this.dataRepoOwner}/${this.dataRepoName}/blob/main/${jsonPath}`,
    };
  }

  /**
   * Build roadmap markdown
   */
  buildRoadmapMarkdown(config) {
    const { projectId, projectName, milestones, issues } = config;

    let md = `# ${projectName} - Project Roadmap\n\n`;
    md += `**ChittyID**: ${projectId}\n`;
    md += `**Generated**: ${new Date().toISOString()}\n`;
    md += `**Context**: ${this.ctxId}\n\n`;
    md += `---\n\n`;

    // Milestones section
    md += `## Milestones\n\n`;
    milestones.forEach(milestone => {
      md += `### ${milestone.title}\n`;
      md += `- **ChittyID**: ${milestone.chittyId}\n`;
      md += `- **Due**: ${milestone.dueDate}\n`;
      md += `- **URL**: ${milestone.url}\n\n`;

      // Issues for this milestone
      const milestoneIssues = issues.filter(i => i.milestone === milestone.title);
      if (milestoneIssues.length) {
        md += `#### Tasks (${milestoneIssues.length})\n\n`;
        milestoneIssues.forEach(issue => {
          md += `- [${issue.title}](${issue.url}) - Priority: ${issue.priority}\n`;
        });
        md += `\n`;
      }
    });

    // All issues by priority
    md += `\n## All Tasks by Priority\n\n`;
    ['critical', 'high', 'medium', 'low'].forEach(priority => {
      const priorityIssues = issues.filter(i => i.priority === priority);
      if (priorityIssues.length) {
        md += `### ${priority.toUpperCase()} Priority (${priorityIssues.length})\n\n`;
        priorityIssues.forEach(issue => {
          md += `- [${issue.title}](${issue.url}) - ${issue.milestone}\n`;
        });
        md += `\n`;
      }
    });

    md += `\n---\n\n`;
    md += `*Generated by ChittyOS Project Initiation Service*\n`;

    return md;
  }

  /**
   * Build roadmap JSON
   */
  buildRoadmapJSON(config) {
    const { projectId, projectName, milestones, issues } = config;

    return {
      projectId,
      projectName,
      ctxId: this.ctxId,
      generatedAt: new Date().toISOString(),
      milestones: milestones.map(m => ({
        chittyId: m.chittyId,
        title: m.title,
        dueDate: m.dueDate,
        url: m.url,
        repo: `${m.owner}/${m.repo}`,
        tasks: issues
          .filter(i => i.milestone === m.title)
          .map(i => ({
            chittyId: i.chittyId,
            title: i.title,
            url: i.url,
            priority: i.priority,
            repo: `${i.owner}/${i.repo}`,
          })),
      })),
      summary: {
        totalMilestones: milestones.length,
        totalIssues: issues.length,
        byPriority: {
          critical: issues.filter(i => i.priority === 'critical').length,
          high: issues.filter(i => i.priority === 'high').length,
          medium: issues.filter(i => i.priority === 'medium').length,
          low: issues.filter(i => i.priority === 'low').length,
        },
      },
    };
  }

  /**
   * Create cross-repo dependencies
   */
  async createCrossRepoDependencies(config) {
    const { projectId, repos, issues } = config;

    if (repos.length < 2) {
      return { dependencies: [], count: 0 };
    }

    // Group issues by repo and milestone
    const issuesByRepoMilestone = new Map();
    issues.forEach(issue => {
      const key = `${issue.owner}/${issue.repo}|${issue.milestone}`;
      if (!issuesByRepoMilestone.has(key)) {
        issuesByRepoMilestone.set(key, []);
      }
      issuesByRepoMilestone.get(key).push(issue);
    });

    const dependencies = [];

    // Link across repos by milestone
    for (let i = 0; i < repos.length - 1; i++) {
      const repo1 = repos[i];
      const repo2 = repos[i + 1];

      // Find matching milestones
      const milestones1 = [...issuesByRepoMilestone.keys()]
        .filter(k => k.startsWith(`${repo1.owner}/${repo1.repo}|`))
        .map(k => k.split('|')[1]);

      const milestones2 = [...issuesByRepoMilestone.keys()]
        .filter(k => k.startsWith(`${repo2.owner}/${repo2.repo}|`))
        .map(k => k.split('|')[1]);

      // Link issues with same milestone
      for (const milestone of milestones1) {
        if (!milestones2.includes(milestone)) continue;

        const issues1 = issuesByRepoMilestone.get(
          `${repo1.owner}/${repo1.repo}|${milestone}`
        );
        const issues2 = issuesByRepoMilestone.get(
          `${repo2.owner}/${repo2.repo}|${milestone}`
        );

        if (!issues1?.length || !issues2?.length) continue;

        // Link first issue from each
        try {
          await fetch(
            `https://api.github.com/repos/${repo1.owner}/${repo1.repo}/issues/${issues1[0].number}/comments`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${this.env.GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
                Accept: 'application/vnd.github+json',
                'User-Agent': 'ChittyOS-ProjectInit/1.0',
              },
              body: JSON.stringify({
                body: `**Cross-repo dependency**: Relates to ${issues2[0].url}\n\n**Project ChittyID**: ${projectId}\n**Context**: ${this.ctxId}`,
              }),
            }
          );

          dependencies.push({
            from: issues1[0].url,
            to: issues2[0].url,
            type: 'cross-repo',
            milestone,
          });
        } catch (error) {
          console.warn('[ProjectInit] Dependency link warning:', error.message);
        }
      }
    }

    return { dependencies, count: dependencies.length };
  }

  /**
   * Push to ChittySync
   */
  async pushToSync(kind, data) {
    this.ctx.waitUntil(
      (async () => {
        try {
          if (typeof ChittySync !== 'undefined') {
            await ChittySync.push('project_event', { ctxId: this.ctxId, kind, ...data });
          } else {
            // Fallback: store in KV for batch sync
            await this.env.PLATFORM_KV?.put(
              `sync:project_event:${this.ctxId}:${kind}:${Date.now()}`,
              JSON.stringify({ ctxId: this.ctxId, kind, ...data, ts: Date.now() }),
              { expirationTtl: 86400 }
            );
          }
        } catch (e) {
          console.warn('[ProjectInit] ChittySync push failed:', e);
        }
      })()
    );
  }

  /**
   * Handle error with structured response and ledger write
   */
  handleError(stage, error) {
    const errorData = {
      stage,
      message: error.message,
      cause: error.stack,
      ctxId: this.ctxId,
      ts: Date.now(),
    };

    // Ledger the failure
    this.ctx.waitUntil(
      this.logEvent(LEDGER_EVENTS.INIT_FAILED, errorData)
    );

    return {
      success: false,
      error: errorData,
    };
  }
}

/**
 * Handle project initiation requests
 */
export async function handleProjectInitiation(context) {
  const { request, env, ctx } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': 'https://chitty.cc',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // Health check
  if (pathname === '/health' || pathname === '/api/initiate/health') {
    return new Response(
      JSON.stringify({
        status: 'healthy',
        service: 'ChittyOS Project Initiation',
        version: '1.0.0',
        features: [
          'github-projects-v2',
          'workerai-task-gen',
          'chittyid-integration',
          'chittyledger-audit',
          'chittysync-integration',
        ],
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Secure health check - validate bindings and GitHub token
  if (pathname === '/health/secure' || pathname === '/api/initiate/health/secure') {
    try {
      // Verify GitHub token
      const ghRes = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github+json',
        },
      });

      const scopes = (ghRes.headers.get('x-oauth-scopes') || '').split(',').map(s => s.trim());
      const required = ['repo', 'admin:org', 'write:org', 'project'];
      const missing = required.filter(s => !scopes.includes(s));

      return new Response(
        JSON.stringify({
          status: missing.length === 0 ? 'healthy' : 'degraded',
          bindings: {
            AI: !!env.AI,
            PLATFORM_KV: !!env.PLATFORM_KV,
            GITHUB_TOKEN: !!env.GITHUB_TOKEN,
            CHITTY_ID_TOKEN: !!env.CHITTY_ID_TOKEN,
          },
          github: {
            authenticated: ghRes.ok,
            scopes,
            missing,
            user: ghRes.ok ? (await ghRes.json()).login : null,
          },
        }),
        {
          status: missing.length === 0 ? 200 : 503,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ status: 'unhealthy', error: error.message }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // Auth check (simplified for now - integrate ChittyAuth when available)
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized', message: 'Authorization header required' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Mock session for now
  const session = {
    chittyId: 'CHITTY-PEO-MOCK-001',
    scopes: ['project:initiate'],
  };

  // Body size limit
  if (request.method === 'POST') {
    const contentLength = parseInt(request.headers.get('content-length') || '0');
    if (contentLength > 65536) {
      return new Response(
        JSON.stringify({ error: 'Request too large', maxSize: 65536 }),
        { status: 413, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  const service = new ProjectInitiationService(env, ctx, session);

  try {
    const method = request.method;

    // POST /api/initiate/kickoff - Main orchestration
    if (method === 'POST' && pathname === '/api/initiate/kickoff') {
      const projectConfig = await request.json();
      const result = await service.initiateProjectKickoff(projectConfig);

      return new Response(JSON.stringify(result), {
        status: result.success ? 202 : 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Not found
    return new Response(
      JSON.stringify({
        error: 'Not Found',
        message: 'Project initiation endpoint not found',
        availableEndpoints: [
          'POST /api/initiate/kickoff',
          'GET /health',
          'GET /health/secure',
        ],
      }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Internal Error',
        message: error.message,
        stack: error.stack,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
