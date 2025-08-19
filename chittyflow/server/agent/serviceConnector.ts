import { storage } from "../storage";
import { startAgentForUser } from "./aiAgent";
import type { InsertConnectedService } from "@shared/schema";

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  authUrl: string;
  tokenUrl: string;
}

// Parse Google OAuth configuration from Replit secrets
function getGoogleOAuthConfig() {
  try {
    // First try the simplified Replit approach
    if (process.env.GOOGLE_OAUTH_SECRETS) {
      const config = JSON.parse(process.env.GOOGLE_OAUTH_SECRETS);
      return {
        clientId: config.web?.client_id || config.client_id,
        clientSecret: config.web?.client_secret || config.client_secret,
      };
    }
    
    // Fallback to individual secrets
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      return {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      };
    }
    
    throw new Error('No Google OAuth configuration found');
  } catch (error) {
    console.error('Failed to parse Google OAuth config:', error);
    throw new Error('Invalid Google OAuth configuration');
  }
}

const googleConfig = getGoogleOAuthConfig();
const redirectUri = `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:5000'}/api/oauth/callback`;

const SERVICE_CONFIGS: Record<string, OAuthConfig> = {
  gmail: {
    clientId: googleConfig.clientId,
    clientSecret: googleConfig.clientSecret,
    redirectUri,
    scopes: ['https://www.googleapis.com/auth/gmail.modify', 'https://www.googleapis.com/auth/gmail.send'],
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
  },
  google_calendar: {
    clientId: googleConfig.clientId,
    clientSecret: googleConfig.clientSecret,
    redirectUri,
    scopes: ['https://www.googleapis.com/auth/calendar'],
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
  },
  google_drive: {
    clientId: googleConfig.clientId,
    clientSecret: googleConfig.clientSecret,
    redirectUri,
    scopes: ['https://www.googleapis.com/auth/drive'],
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
  },
};

export class ServiceConnector {
  static generateAuthUrl(serviceType: string, userId: string): string {
    const config = SERVICE_CONFIGS[serviceType];
    if (!config) {
      throw new Error(`Unsupported service type: ${serviceType}`);
    }

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: config.scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state: `${serviceType}:${userId}`, // Pass service type and user ID
    });

    return `${config.authUrl}?${params.toString()}`;
  }

  static async handleOAuthCallback(code: string, state: string): Promise<{success: boolean, message: string}> {
    try {
      const [serviceType, userId] = state.split(':');
      const config = SERVICE_CONFIGS[serviceType];
      
      if (!config) {
        return { success: false, message: 'Invalid service type' };
      }

      // Exchange code for tokens
      const tokenResponse = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: config.redirectUri,
        }),
      });

      const tokens = await tokenResponse.json();
      
      if (!tokens.access_token) {
        return { success: false, message: 'Failed to obtain access token' };
      }

      // Get account information to identify the specific account
      let accountEmail = '';
      let accountDisplayName = '';

      try {
        // Fetch user info from Google's userinfo endpoint for Google services
        if (serviceType.startsWith('gmail') || serviceType.startsWith('google_')) {
          const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
              'Authorization': `Bearer ${tokens.access_token}`,
            },
          });
          
          if (userInfoResponse.ok) {
            const userInfo = await userInfoResponse.json();
            accountEmail = userInfo.email || '';
            accountDisplayName = userInfo.name || userInfo.email || 'Google Account';
          }
        }
      } catch (error) {
        console.warn('Failed to fetch account info:', error);
        // Continue without account info
      }

      // Check if this account is already connected
      const existingServices = await storage.getConnectedServices(userId);
      const existingAccount = existingServices.find(s => 
        s.serviceType === serviceType && s.accountEmail === accountEmail
      );

      if (existingAccount && accountEmail) {
        // Update existing connection
        await storage.updateConnectedService(existingAccount.id, {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
          isActive: true,
          lastSync: new Date(),
        });

        return { 
          success: true, 
          message: `Successfully reconnected ${accountDisplayName || accountEmail}! Your AI assistant will continue monitoring this account.` 
        };
      }

      // Create display name for this account
      const serviceName = this.getServiceDisplayName(serviceType);
      const displayName = accountDisplayName || accountEmail || serviceName;
      const fullDisplayName = accountEmail && accountEmail !== displayName ? 
        `${serviceName} (${accountEmail})` : displayName;

      // Store the service connection
      const serviceData: InsertConnectedService = {
        userId,
        serviceType: serviceType as any,
        serviceName: fullDisplayName,
        accountEmail,
        accountDisplayName: displayName,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
        isActive: true,
        settings: {},
      };

      await storage.createConnectedService(serviceData);
      
      // Start the AI agent for this user if not already running
      await startAgentForUser(userId);

      return { 
        success: true, 
        message: `Successfully connected ${fullDisplayName}! Your AI assistant is now monitoring and managing this account.` 
      };
    } catch (error) {
      console.error('OAuth callback error:', error);
      return { success: false, message: 'Failed to complete authentication' };
    }
  }

  static getServiceDisplayName(serviceType: string): string {
    const names: Record<string, string> = {
      gmail: 'Gmail',
      google_calendar: 'Google Calendar',
      google_drive: 'Google Drive',
      outlook: 'Outlook',
      outlook_calendar: 'Outlook Calendar',
      dropbox: 'Dropbox',
      slack: 'Slack',
      discord: 'Discord',
      twitter: 'Twitter',
      linkedin: 'LinkedIn',
    };
    
    return names[serviceType] || serviceType;
  }

  static getAvailableServices(): Array<{type: string, name: string, description: string, features: string[]}> {
    return [
      {
        type: 'gmail',
        name: 'Gmail',
        description: 'Email management and automation',
        features: [
          'Automatic email organization',
          'Smart unsubscribe suggestions',
          'Draft responses for routine emails',
          'Newsletter cleanup',
          'Important email detection'
        ]
      },
      {
        type: 'google_calendar',
        name: 'Google Calendar',
        description: 'Calendar optimization and meeting management',
        features: [
          'Meeting preparation assistance',
          'Optimal scheduling suggestions',
          'Energy-aware meeting placement',
          'Automatic agenda creation',
          'Focus time blocking'
        ]
      },
      {
        type: 'google_drive',
        name: 'Google Drive',
        description: 'Document organization and management',
        features: [
          'Automatic file organization',
          'Smart folder suggestions',
          'Duplicate file cleanup',
          'Version management',
          'Content-based categorization'
        ]
      }
    ];
  }

  static async disconnectService(userId: string, serviceId: string): Promise<void> {
    await storage.deleteConnectedService(serviceId);
    
    // TODO: Revoke OAuth tokens with the service provider
    // This requires implementing revocation for each service
  }

  static async refreshTokenIfNeeded(service: any): Promise<boolean> {
    if (!service.expiresAt || new Date() < service.expiresAt) {
      return true; // Token is still valid
    }

    if (!service.refreshToken) {
      await storage.updateConnectedService(service.id, { isActive: false });
      return false; // Cannot refresh
    }

    try {
      const config = SERVICE_CONFIGS[service.serviceType];
      const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          refresh_token: service.refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      const tokens = await response.json();
      
      if (tokens.access_token) {
        await storage.updateConnectedService(service.id, {
          accessToken: tokens.access_token,
          expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
          lastSync: new Date(),
        });
        return true;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }

    await storage.updateConnectedService(service.id, { isActive: false });
    return false;
  }
}