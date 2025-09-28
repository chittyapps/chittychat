#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Topic Analyzer with Hooks
 *
 * Analyzes every user input to:
 * 1. Extract topic tags automatically
 * 2. Write to session log with tags
 * 3. Update session relevance in real-time
 * 4. Trigger cross-session sync only for relevant topics
 */
class TopicAnalyzer {
  constructor(config = {}) {
    this.sessionId = config.sessionId;
    this.baseDir = config.baseDir || path.join(process.cwd(), '.ai-coordination');
    this.sessionLogFile = path.join(this.baseDir, 'logs', `session-${this.sessionId}.jsonl`);

    // Topic patterns and keywords for auto-tagging
    this.topicPatterns = {
      // Programming languages
      javascript: /\b(javascript|js|node|npm|react|vue|angular|typescript|ts)\b/i,
      python: /\b(python|pip|django|flask|pandas|numpy|jupyter)\b/i,
      rust: /\b(rust|cargo|rustc|crate)\b/i,
      go: /\b(golang|go\s+mod|go\s+get)\b/i,

      // Frameworks & Tools
      ai_ml: /\b(machine learning|ml|ai|neural|tensorflow|pytorch|llm|gpt|claude)\b/i,
      database: /\b(database|sql|postgres|mysql|mongo|redis|neon|drizzle)\b/i,
      cloud: /\b(cloud|aws|azure|gcp|cloudflare|vercel|netlify)\b/i,
      devops: /\b(docker|kubernetes|k8s|ci\/cd|github actions|jenkins)\b/i,

      // ChittyOS specific
      chittyos: /\b(chitty|chittychat|chittyid|chittychain|chittyflow)\b/i,
      blockchain: /\b(blockchain|crypto|smart contract|web3|ethereum)\b/i,

      // Task types
      debugging: /\b(bug|error|fix|issue|problem|debug|troubleshoot)\b/i,
      feature: /\b(feature|implement|add|create|build|develop)\b/i,
      refactor: /\b(refactor|optimize|improve|cleanup|reorganize)\b/i,
      documentation: /\b(document|docs|readme|comment|explain)\b/i,
      testing: /\b(test|testing|qa|quality|validate|verify)\b/i,

      // Domains
      finance: /\b(finance|payment|transaction|accounting|invoice|budget)\b/i,
      security: /\b(security|auth|authentication|permission|encrypt|password)\b/i,
      api: /\b(api|endpoint|rest|graphql|webhook|integration)\b/i,
      frontend: /\b(ui|ux|css|html|design|layout|component|style)\b/i,
      backend: /\b(server|backend|api|database|service|endpoint)\b/i
    };

    // Semantic similarity groups (tags that should sync together)
    this.semanticGroups = {
      webdev: ['javascript', 'frontend', 'backend', 'api'],
      infrastructure: ['cloud', 'devops', 'database'],
      aidev: ['ai_ml', 'python', 'jupyter'],
      chitty_ecosystem: ['chittyos', 'blockchain', 'finance'],
      quality: ['testing', 'debugging', 'security']
    };

    // Session context for better analysis
    this.sessionContext = {
      recentTags: [],
      dominantTopics: new Map(),
      conversationHistory: []
    };

    // Hooks for different events
    this.hooks = new Map();
    this.setupDefaultHooks();
  }

  /**
   * Setup default hooks for topic analysis
   */
  setupDefaultHooks() {
    // Hook: Before processing user input
    this.registerHook('before_input', async (input) => {
      console.log(`[HOOK] Analyzing input: ${input.substring(0, 100)}...`);
      return input;
    });

    // Hook: After extracting tags
    this.registerHook('after_tags', async (tags, input) => {
      // Write to session log
      await this.writeToSessionLog({
        type: 'topic_analysis',
        input: input.substring(0, 500),
        tags: tags,
        timestamp: Date.now()
      });

      // Update session relevance
      await this.updateSessionRelevance(tags);

      return tags;
    });

    // Hook: On topic change
    this.registerHook('topic_change', async (oldTopic, newTopic) => {
      console.log(`[HOOK] Topic shifted from ${oldTopic} to ${newTopic}`);

      // Notify cross-session sync of topic change
      await this.notifyTopicChange(oldTopic, newTopic);
    });

    // Hook: On relevance threshold
    this.registerHook('relevance_threshold', async (relevantSessions) => {
      console.log(`[HOOK] Found ${relevantSessions.length} relevant sessions for sync`);

      // Trigger sync only with relevant sessions
      await this.triggerRelevantSync(relevantSessions);
    });
  }

  /**
   * Register a custom hook
   */
  registerHook(event, handler) {
    if (!this.hooks.has(event)) {
      this.hooks.set(event, []);
    }
    this.hooks.get(event).push(handler);
  }

  /**
   * Execute hooks for an event
   */
  async executeHooks(event, ...args) {
    const handlers = this.hooks.get(event) || [];
    let result = args[0];

    for (const handler of handlers) {
      result = await handler(...args) || result;
    }

    return result;
  }

  /**
   * Analyze user input and extract topic tags
   */
  async analyzeInput(input) {
    // Execute before_input hook
    input = await this.executeHooks('before_input', input);

    const tags = new Set();
    const scores = new Map();

    // Pattern matching for explicit tags
    for (const [tag, pattern] of Object.entries(this.topicPatterns)) {
      const matches = input.match(pattern);
      if (matches) {
        tags.add(tag);
        // Calculate relevance score based on frequency
        const frequency = (input.match(new RegExp(pattern.source, 'gi')) || []).length;
        scores.set(tag, frequency);
      }
    }

    // Context-based tagging (look at conversation history)
    this.enhanceWithContext(tags, scores);

    // Semantic expansion (add related tags)
    this.expandSemantically(tags);

    // Convert to sorted array by relevance
    const sortedTags = Array.from(tags).sort((a, b) => {
      return (scores.get(b) || 0) - (scores.get(a) || 0);
    });

    // Update session context
    this.updateContext(sortedTags, input);

    // Execute after_tags hook
    await this.executeHooks('after_tags', sortedTags, input);

    // Check for topic changes
    await this.detectTopicShift(sortedTags);

    return {
      tags: sortedTags,
      scores: Object.fromEntries(scores),
      dominant: sortedTags[0] || null,
      confidence: this.calculateConfidence(scores)
    };
  }

  /**
   * Enhance tags based on conversation context
   */
  enhanceWithContext(tags, scores) {
    // If recent tags included certain topics, boost related ones
    for (const recentTag of this.sessionContext.recentTags.slice(-5)) {
      // Find semantic group
      for (const [group, members] of Object.entries(this.semanticGroups)) {
        if (members.includes(recentTag)) {
          // Boost other members of the same group if mentioned
          for (const member of members) {
            if (tags.has(member)) {
              scores.set(member, (scores.get(member) || 0) + 0.5);
            }
          }
        }
      }
    }

    // Look for implicit patterns in conversation history
    const recentInputs = this.sessionContext.conversationHistory.slice(-3).join(' ');

    // If talking about errors/bugs, likely debugging
    if (recentInputs.includes('error') || recentInputs.includes('failed')) {
      if (!tags.has('debugging')) {
        tags.add('debugging');
        scores.set('debugging', 0.3);
      }
    }

    // If multiple code blocks, likely programming
    if ((recentInputs.match(/```/g) || []).length > 2) {
      if (!tags.has('feature')) {
        tags.add('feature');
        scores.set('feature', 0.3);
      }
    }
  }

  /**
   * Expand tags semantically
   */
  expandSemantically(tags) {
    const expansions = new Set(tags);

    for (const tag of tags) {
      // Find all semantic groups this tag belongs to
      for (const [group, members] of Object.entries(this.semanticGroups)) {
        if (members.includes(tag)) {
          // If multiple members of a group are present, add the group tag
          const presentMembers = members.filter(m => tags.has(m));
          if (presentMembers.length >= 2) {
            expansions.add(group);
          }
        }
      }
    }

    // Add expansions back to original set
    for (const expansion of expansions) {
      tags.add(expansion);
    }
  }

  /**
   * Update session context
   */
  updateContext(tags, input) {
    // Update recent tags (keep last 20)
    this.sessionContext.recentTags.push(...tags);
    if (this.sessionContext.recentTags.length > 20) {
      this.sessionContext.recentTags = this.sessionContext.recentTags.slice(-20);
    }

    // Update dominant topics
    for (const tag of tags) {
      const count = (this.sessionContext.dominantTopics.get(tag) || 0) + 1;
      this.sessionContext.dominantTopics.set(tag, count);
    }

    // Update conversation history (keep last 10)
    this.sessionContext.conversationHistory.push(input.substring(0, 200));
    if (this.sessionContext.conversationHistory.length > 10) {
      this.sessionContext.conversationHistory.shift();
    }
  }

  /**
   * Detect topic shifts in conversation
   */
  async detectTopicShift(currentTags) {
    if (currentTags.length === 0) return;

    const currentDominant = currentTags[0];
    const previousDominant = this.sessionContext.recentTags[this.sessionContext.recentTags.length - tags.length - 1];

    if (previousDominant && currentDominant !== previousDominant) {
      // Topic has shifted
      await this.executeHooks('topic_change', previousDominant, currentDominant);
    }
  }

  /**
   * Calculate confidence score for tags
   */
  calculateConfidence(scores) {
    if (scores.size === 0) return 0;

    const values = Array.from(scores.values());
    const total = values.reduce((a, b) => a + b, 0);
    const max = Math.max(...values);

    // Confidence based on how dominant the top tag is
    return max / total;
  }

  /**
   * Write to session log
   */
  async writeToSessionLog(entry) {
    await fs.mkdir(path.dirname(this.sessionLogFile), { recursive: true });

    const logEntry = {
      ...entry,
      sessionId: this.sessionId,
      timestamp: Date.now()
    };

    await fs.appendFile(this.sessionLogFile, JSON.stringify(logEntry) + '\n');
  }

  /**
   * Update session relevance based on tags
   */
  async updateSessionRelevance(tags) {
    const relevanceFile = path.join(this.baseDir, 'relevance', `${this.sessionId}.json`);
    await fs.mkdir(path.dirname(relevanceFile), { recursive: true });

    const relevance = {
      sessionId: this.sessionId,
      tags: tags,
      dominantTopics: Array.from(this.sessionContext.dominantTopics.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag, count]) => ({ tag, count })),
      lastUpdate: Date.now()
    };

    await fs.writeFile(relevanceFile, JSON.stringify(relevance, null, 2));

    // Find other relevant sessions
    await this.findRelevantSessions(tags);
  }

  /**
   * Find sessions with overlapping topics
   */
  async findRelevantSessions(currentTags) {
    const relevanceDir = path.join(this.baseDir, 'relevance');
    const relevantSessions = [];

    try {
      const files = await fs.readdir(relevanceDir);

      for (const file of files) {
        if (file === `${this.sessionId}.json`) continue;

        const otherSession = JSON.parse(
          await fs.readFile(path.join(relevanceDir, file), 'utf8')
        );

        // Calculate overlap score
        const overlap = this.calculateTagOverlap(currentTags, otherSession.tags);

        if (overlap > 0.3) { // 30% overlap threshold
          relevantSessions.push({
            sessionId: otherSession.sessionId,
            overlap: overlap,
            sharedTags: currentTags.filter(tag => otherSession.tags.includes(tag))
          });
        }
      }

      // Sort by relevance
      relevantSessions.sort((a, b) => b.overlap - a.overlap);

      // Execute relevance threshold hook
      if (relevantSessions.length > 0) {
        await this.executeHooks('relevance_threshold', relevantSessions);
      }

      return relevantSessions;

    } catch (error) {
      return [];
    }
  }

  /**
   * Calculate tag overlap score
   */
  calculateTagOverlap(tags1, tags2) {
    if (tags1.length === 0 || tags2.length === 0) return 0;

    const set1 = new Set(tags1);
    const set2 = new Set(tags2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));

    // Jaccard similarity coefficient
    const union = new Set([...set1, ...set2]);
    return intersection.size / union.size;
  }

  /**
   * Notify topic change
   */
  async notifyTopicChange(oldTopic, newTopic) {
    const changeEvent = {
      type: 'topic_change',
      sessionId: this.sessionId,
      from: oldTopic,
      to: newTopic,
      timestamp: Date.now()
    };

    // Write to events
    const eventFile = path.join(this.baseDir, 'events', 'topic-changes.jsonl');
    await fs.mkdir(path.dirname(eventFile), { recursive: true });
    await fs.appendFile(eventFile, JSON.stringify(changeEvent) + '\n');
  }

  /**
   * Trigger sync only with relevant sessions
   */
  async triggerRelevantSync(relevantSessions) {
    const syncTrigger = {
      type: 'sync_trigger',
      sessionId: this.sessionId,
      targetSessions: relevantSessions.map(s => s.sessionId),
      tags: this.sessionContext.recentTags.slice(-10),
      timestamp: Date.now()
    };

    // Write sync trigger
    const triggerFile = path.join(this.baseDir, 'sync-triggers', `${Date.now()}.json`);
    await fs.mkdir(path.dirname(triggerFile), { recursive: true });
    await fs.writeFile(triggerFile, JSON.stringify(syncTrigger, null, 2));

    console.log(`Triggered sync with ${relevantSessions.length} relevant sessions`);
  }

  /**
   * Get session analytics
   */
  getAnalytics() {
    const sortedTopics = Array.from(this.sessionContext.dominantTopics.entries())
      .sort((a, b) => b[1] - a[1]);

    return {
      sessionId: this.sessionId,
      dominantTopics: sortedTopics.slice(0, 10),
      recentTags: [...new Set(this.sessionContext.recentTags)],
      totalAnalyzed: this.sessionContext.conversationHistory.length,
      topicDiversity: this.sessionContext.dominantTopics.size
    };
  }
}

export default TopicAnalyzer;

// Example hook registration for integration
export function registerTopicHooks(analyzer) {
  // Custom hook: Log to ChittyChat when important topics detected
  analyzer.registerHook('after_tags', async (tags, input) => {
    const importantTags = ['security', 'finance', 'blockchain', 'debugging'];
    const detected = tags.filter(tag => importantTags.includes(tag));

    if (detected.length > 0) {
      console.log(`[IMPORTANT] Detected critical topics: ${detected.join(', ')}`);
      // Could send to ChittyChat API here
    }
  });

  // Custom hook: Auto-create project on new topic cluster
  analyzer.registerHook('topic_change', async (oldTopic, newTopic) => {
    if (!oldTopic || (newTopic && !oldTopic.includes(newTopic))) {
      console.log(`[PROJECT] Consider creating new project for topic: ${newTopic}`);
      // Could auto-create ChittyChat project here
    }
  });
}