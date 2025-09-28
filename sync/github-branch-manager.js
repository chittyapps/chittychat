#!/usr/bin/env node

/**
 * GitHub Branch Manager for ChittyChat
 * Handles automated branch management, divergence detection, and merge scheduling
 */

const { Octokit } = require('@octokit/rest');
const cron = require('node-cron');
const { execSync } = require('child_process');

class ChittyBranchManager {
  constructor(config) {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });
    
    this.config = {
      owner: config.owner || 'ChittyFoundation',
      repo: config.repo || 'chittychat',
      maxDivergence: config.maxDivergence || 50, // commits
      staleThreshold: config.staleThreshold || 7, // days
      autoMergeThreshold: config.autoMergeThreshold || 3, // days
      ...config
    };
    
    this.initCronJobs();
  }

  /**
   * Initialize scheduled cron jobs
   */
  initCronJobs() {
    // Every hour: Check branch divergence
    cron.schedule('0 * * * *', async () => {
      console.log('⏰ Running hourly branch divergence check...');
      await this.checkBranchDivergence();
    });

    // Every 6 hours: Auto-merge safe branches
    cron.schedule('0 */6 * * *', async () => {
      console.log('⏰ Running 6-hour auto-merge check...');
      await this.autoMergeSafeBranches();
    });

    // Daily at 2 AM: Clean up stale branches
    cron.schedule('0 2 * * *', async () => {
      console.log('⏰ Running daily stale branch cleanup...');
      await this.cleanupStaleBranches();
    });

    // Every 30 minutes: Sync session branches
    cron.schedule('*/30 * * * *', async () => {
      console.log('⏰ Running 30-minute session sync...');
      await this.syncSessionBranches();
    });
  }

  /**
   * Check how far branches have diverged from main
   */
  async checkBranchDivergence() {
    try {
      const { data: branches } = await this.octokit.repos.listBranches({
        owner: this.config.owner,
        repo: this.config.repo
      });

      for (const branch of branches) {
        if (branch.name === 'main') continue;
        
        // Get divergence stats
        const divergence = await this.getBranchDivergence(branch.name);
        
        if (divergence.behind > this.config.maxDivergence) {
          await this.handleHighDivergence(branch.name, divergence);
        } else if (divergence.behind > this.config.maxDivergence / 2) {
          await this.createDivergenceWarning(branch.name, divergence);
        }
      }
    } catch (error) {
      console.error('❌ Branch divergence check failed:', error);
    }
  }

  /**
   * Get divergence statistics for a branch
   */
  async getBranchDivergence(branchName) {
    const { data } = await this.octokit.repos.compareCommits({
      owner: this.config.owner,
      repo: this.config.repo,
      base: 'main',
      head: branchName
    });

    return {
      ahead: data.ahead_by,
      behind: data.behind_by,
      totalDivergence: data.ahead_by + data.behind_by,
      conflicts: data.files?.filter(f => f.status === 'conflicted').length || 0
    };
  }

  /**
   * Handle branches with high divergence
   */
  async handleHighDivergence(branchName, divergence) {
    console.warn(`⚠️ High divergence detected on ${branchName}:`, divergence);
    
    // Create GitHub issue
    await this.octokit.issues.create({
      owner: this.config.owner,
      repo: this.config.repo,
      title: `Branch ${branchName} has high divergence`,
      body: `### Divergence Alert\n\n` +
            `Branch **${branchName}** is significantly behind main:\n` +
            `- Behind by: ${divergence.behind} commits\n` +
            `- Ahead by: ${divergence.ahead} commits\n` +
            `- Potential conflicts: ${divergence.conflicts}\n\n` +
            `**Action Required**: Please rebase or merge main into this branch.`,
      labels: ['branch-divergence', 'needs-merge']
    });

    // If auto-rebase is enabled
    if (this.config.autoRebase && divergence.conflicts === 0) {
      await this.attemptAutoRebase(branchName);
    }
  }

  /**
   * Create warning for moderate divergence
   */
  async createDivergenceWarning(branchName, divergence) {
    // Add warning comment to PR if exists
    const prs = await this.octokit.pulls.list({
      owner: this.config.owner,
      repo: this.config.repo,
      head: `${this.config.owner}:${branchName}`,
      state: 'open'
    });

    if (prs.data.length > 0) {
      await this.octokit.issues.createComment({
        owner: this.config.owner,
        repo: this.config.repo,
        issue_number: prs.data[0].number,
        body: `⚠️ **Branch Divergence Warning**\n\n` +
              `This branch is ${divergence.behind} commits behind main. ` +
              `Consider merging or rebasing soon to avoid conflicts.`
      });
    }
  }

  /**
   * Auto-merge branches that meet criteria
   */
  async autoMergeSafeBranches() {
    const { data: pulls } = await this.octokit.pulls.list({
      owner: this.config.owner,
      repo: this.config.repo,
      state: 'open',
      sort: 'created',
      direction: 'asc'
    });

    for (const pr of pulls) {
      const age = (Date.now() - new Date(pr.created_at)) / (1000 * 60 * 60 * 24);
      
      if (age > this.config.autoMergeThreshold) {
        const checks = await this.canAutoMerge(pr);
        
        if (checks.safe) {
          console.log(`✅ Auto-merging PR #${pr.number}: ${pr.title}`);
          await this.performAutoMerge(pr);
        } else {
          console.log(`⏸️ Cannot auto-merge PR #${pr.number}: ${checks.reason}`);
        }
      }
    }
  }

  /**
   * Check if PR can be auto-merged
   */
  async canAutoMerge(pr) {
    // Check status checks
    const { data: status } = await this.octokit.repos.getCombinedStatusForRef({
      owner: this.config.owner,
      repo: this.config.repo,
      ref: pr.head.sha
    });

    if (status.state !== 'success') {
      return { safe: false, reason: 'Status checks not passing' };
    }

    // Check for conflicts
    if (pr.mergeable_state === 'conflicting') {
      return { safe: false, reason: 'Has merge conflicts' };
    }

    // Check reviews
    const { data: reviews } = await this.octokit.pulls.listReviews({
      owner: this.config.owner,
      repo: this.config.repo,
      pull_number: pr.number
    });

    const approved = reviews.some(r => r.state === 'APPROVED');
    if (!approved && this.config.requireApproval) {
      return { safe: false, reason: 'No approval' };
    }

    return { safe: true };
  }

  /**
   * Perform auto-merge
   */
  async performAutoMerge(pr) {
    try {
      await this.octokit.pulls.merge({
        owner: this.config.owner,
        repo: this.config.repo,
        pull_number: pr.number,
        merge_method: 'squash',
        commit_title: `Auto-merge: ${pr.title}`,
        commit_message: `Automatically merged after ${this.config.autoMergeThreshold} days\n\n` +
                        `ChittyChat auto-merge performed at ${new Date().toISOString()}`
      });
      
      // Mine to blockchain if configured
      if (this.config.mintOnMerge) {
        execSync(`chittychat mint --pr ${pr.number} --to-blockchain`);
      }
    } catch (error) {
      console.error(`❌ Auto-merge failed for PR #${pr.number}:`, error);
    }
  }

  /**
   * Clean up stale branches
   */
  async cleanupStaleBranches() {
    const { data: branches } = await this.octokit.repos.listBranches({
      owner: this.config.owner,
      repo: this.config.repo
    });

    for (const branch of branches) {
      if (branch.name === 'main' || branch.protected) continue;
      
      // Get last commit date
      const { data: commit } = await this.octokit.repos.getCommit({
        owner: this.config.owner,
        repo: this.config.repo,
        ref: branch.commit.sha
      });
      
      const age = (Date.now() - new Date(commit.commit.author.date)) / (1000 * 60 * 60 * 24);
      
      if (age > this.config.staleThreshold) {
        console.log(`🗑️ Marking branch ${branch.name} as stale (${Math.floor(age)} days old)`);
        
        // Check if branch has open PR
        const prs = await this.octokit.pulls.list({
          owner: this.config.owner,
          repo: this.config.repo,
          head: `${this.config.owner}:${branch.name}`,
          state: 'open'
        });
        
        if (prs.data.length === 0 && age > this.config.staleThreshold * 2) {
          // Delete very stale branches with no PR
          await this.deleteStaleBranch(branch.name);
        }
      }
    }
  }

  /**
   * Sync session branches periodically
   */
  async syncSessionBranches() {
    const sessionPattern = /^session-[a-f0-9]{8}-/;
    
    const { data: branches } = await this.octokit.repos.listBranches({
      owner: this.config.owner,
      repo: this.config.repo
    });
    
    const sessionBranches = branches.filter(b => sessionPattern.test(b.name));
    
    for (const branch of sessionBranches) {
      const divergence = await this.getBranchDivergence(branch.name);
      
      // If behind but no conflicts, auto-sync
      if (divergence.behind > 0 && divergence.conflicts === 0) {
        console.log(`🔄 Auto-syncing session branch ${branch.name}`);
        await this.syncBranchWithMain(branch.name);
      }
    }
  }

  /**
   * Sync branch with main
   */
  async syncBranchWithMain(branchName) {
    try {
      // Create a merge commit from main
      await this.octokit.repos.merge({
        owner: this.config.owner,
        repo: this.config.repo,
        base: branchName,
        head: 'main',
        commit_message: `Auto-sync: Merge main into ${branchName}`
      });
      
      console.log(`✅ Successfully synced ${branchName} with main`);
    } catch (error) {
      console.error(`❌ Failed to sync ${branchName}:`, error.message);
    }
  }

  /**
   * Attempt auto-rebase for conflict-free branches
   */
  async attemptAutoRebase(branchName) {
    console.log(`🔄 Attempting auto-rebase for ${branchName}`);
    
    try {
      // This would typically be done through a GitHub Action
      // or a local git operation with proper authentication
      execSync(`git checkout ${branchName} && git rebase main && git push --force-with-lease`);
      
      console.log(`✅ Successfully rebased ${branchName}`);
    } catch (error) {
      console.error(`❌ Auto-rebase failed for ${branchName}:`, error);
    }
  }

  /**
   * Delete stale branch
   */
  async deleteStaleBranch(branchName) {
    try {
      await this.octokit.git.deleteRef({
        owner: this.config.owner,
        repo: this.config.repo,
        ref: `heads/${branchName}`
      });
      
      console.log(`✅ Deleted stale branch ${branchName}`);
    } catch (error) {
      console.error(`❌ Failed to delete ${branchName}:`, error);
    }
  }
}

// Initialize and start the branch manager
if (require.main === module) {
  const manager = new ChittyBranchManager({
    owner: process.env.GITHUB_OWNER || 'ChittyFoundation',
    repo: process.env.GITHUB_REPO || 'chittychat',
    maxDivergence: 50,
    staleThreshold: 7,
    autoMergeThreshold: 3,
    requireApproval: false,
    autoRebase: true,
    mintOnMerge: true
  });
  
  console.log('🚀 ChittyChat Branch Manager started');
  console.log('⏰ Cron jobs scheduled:');
  console.log('  - Hourly: Branch divergence check');
  console.log('  - Every 6 hours: Auto-merge safe branches');
  console.log('  - Daily at 2 AM: Stale branch cleanup');
  console.log('  - Every 30 minutes: Session branch sync');
}

module.exports = ChittyBranchManager;