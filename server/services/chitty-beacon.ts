import fs from 'fs';
import path from 'path';
import os from 'os';

interface BeaconData {
  id: string;
  name: string;
  version: string;
  platform: string;
  has_claude_code: boolean;
  has_git: boolean;
  node_version: string;
  os_platform: string;
  os_arch: string;
  replit_slug?: string;
  event_type: 'startup' | 'heartbeat' | 'shutdown';
  timestamp: string;
  uptime_seconds: number;
  memory_usage?: NodeJS.MemoryUsage;
  cpu_arch: string;
  project_type?: string;
  mcp_enabled: boolean;
  chittypm_version: string;
}

class ChittyBeacon {
  private appId: string;
  private appName: string;
  private appVersion: string;
  private platform: string;
  private endpoint: string;
  private interval: number;
  private disabled: boolean;
  private verbose: boolean;
  private heartbeatTimer?: NodeJS.Timeout;
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
    this.endpoint = process.env.BEACON_ENDPOINT || 'https://beacon.cloudeto.com';
    this.interval = parseInt(process.env.BEACON_INTERVAL || '300000'); // 5 minutes
    this.disabled = process.env.BEACON_DISABLED === 'true';
    this.verbose = process.env.BEACON_VERBOSE === 'true';

    // Detect platform and app info
    this.platform = this.detectPlatform();
    this.appId = this.generateAppId();
    
    const packageJson = this.loadPackageJson();
    this.appName = packageJson.name || 'chittypm';
    this.appVersion = packageJson.version || '1.0.0';

    if (!this.disabled) {
      this.init();
    }
  }

  private detectPlatform(): string {
    // Replit detection
    if (process.env.REPL_ID || process.env.REPL_SLUG) {
      return 'replit';
    }
    
    // GitHub Actions
    if (process.env.GITHUB_ACTIONS) {
      return 'github-actions';
    }
    
    // Vercel
    if (process.env.VERCEL || process.env.NOW_REGION) {
      return 'vercel';
    }
    
    // Netlify
    if (process.env.NETLIFY) {
      return 'netlify';
    }
    
    // Heroku
    if (process.env.DYNO) {
      return 'heroku';
    }
    
    // AWS Lambda
    if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
      return 'aws-lambda';
    }
    
    // Google Cloud
    if (process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT) {
      return 'google-cloud';
    }
    
    // Azure
    if (process.env.AZURE_FUNCTIONS_ENVIRONMENT) {
      return 'azure';
    }

    return 'unknown';
  }

  private generateAppId(): string {
    if (process.env.REPL_ID) {
      return `replit-${process.env.REPL_ID}`;
    }
    
    if (process.env.REPL_SLUG) {
      return `replit-${process.env.REPL_SLUG}`;
    }

    // Generate a stable ID for the current directory
    const projectPath = process.cwd();
    const hash = projectPath.split('').reduce((acc, char) => {
      return acc + char.charCodeAt(0);
    }, 0);
    
    return `chittypm-${hash.toString(36)}`;
  }

  private loadPackageJson(): any {
    try {
      const packagePath = path.join(process.cwd(), 'package.json');
      if (fs.existsSync(packagePath)) {
        return JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      }
    } catch (error) {
      if (this.verbose) {
        console.log('ChittyBeacon: Could not load package.json:', error);
      }
    }
    return {};
  }

  private hasClaudeCode(): boolean {
    try {
      // Check for common Claude Code indicators
      const currentDir = process.cwd();
      
      // Check for .replit file
      if (fs.existsSync(path.join(currentDir, '.replit'))) {
        const replitConfig = fs.readFileSync(path.join(currentDir, '.replit'), 'utf8');
        if (replitConfig.includes('claude') || replitConfig.includes('anthropic')) {
          return true;
        }
      }
      
      // Check for README or documentation mentioning Claude
      const readmeFiles = ['README.md', 'readme.md', 'README.txt'];
      for (const readme of readmeFiles) {
        if (fs.existsSync(path.join(currentDir, readme))) {
          const content = fs.readFileSync(path.join(currentDir, readme), 'utf8');
          if (content.toLowerCase().includes('claude') || content.toLowerCase().includes('anthropic')) {
            return true;
          }
        }
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  private hasGit(): boolean {
    try {
      return fs.existsSync(path.join(process.cwd(), '.git'));
    } catch (error) {
      return false;
    }
  }

  private createBeaconData(eventType: 'startup' | 'heartbeat' | 'shutdown'): BeaconData {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    
    return {
      id: this.appId,
      name: this.appName,
      version: this.appVersion,
      platform: this.platform,
      has_claude_code: this.hasClaudeCode(),
      has_git: this.hasGit(),
      node_version: process.version,
      os_platform: os.platform(),
      os_arch: os.arch(),
      cpu_arch: process.arch,
      replit_slug: process.env.REPL_SLUG,
      event_type: eventType,
      timestamp: new Date().toISOString(),
      uptime_seconds: uptime,
      memory_usage: process.memoryUsage(),
      project_type: 'mcp-project-management',
      mcp_enabled: true,
      chittypm_version: this.appVersion
    };
  }

  private async sendBeacon(data: BeaconData): Promise<void> {
    if (this.disabled) return;

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': `ChittyPM-Beacon/${this.appVersion}`
        },
        body: JSON.stringify(data)
      });

      if (this.verbose) {
        console.log(`ChittyBeacon: Sent ${data.event_type} beacon:`, {
          status: response.status,
          data: { ...data, memory_usage: undefined } // Don't log memory details
        });
      }
    } catch (error) {
      if (this.verbose) {
        console.log(`ChittyBeacon: Failed to send ${data.event_type} beacon:`, error instanceof Error ? error.message : 'Unknown error');
      }
    }
  }

  private init(): void {
    // Send startup beacon
    this.sendBeacon(this.createBeaconData('startup'));

    // Set up heartbeat
    this.heartbeatTimer = setInterval(() => {
      this.sendBeacon(this.createBeaconData('heartbeat'));
    }, this.interval);

    // Handle process shutdown
    const shutdown = () => {
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
      }
      this.sendBeacon(this.createBeaconData('shutdown'));
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('exit', shutdown);

    if (this.verbose) {
      console.log('ChittyBeacon: Initialized for', this.appName, 'on', this.platform);
    }
  }

  public getStatus() {
    return {
      appId: this.appId,
      appName: this.appName,
      platform: this.platform,
      disabled: this.disabled,
      endpoint: this.endpoint,
      uptime: Math.floor((Date.now() - this.startTime) / 1000)
    };
  }
}

// Create singleton instance
let beacon: ChittyBeacon | null = null;

export function initializeChittyBeacon(): ChittyBeacon {
  if (!beacon) {
    beacon = new ChittyBeacon();
  }
  return beacon;
}

export function getChittyBeacon(): ChittyBeacon | null {
  return beacon;
}
