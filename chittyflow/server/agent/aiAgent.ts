import { storage } from "../storage";
import { emailService } from "./services/emailService";
import { calendarService } from "./services/calendarService";
import { documentService } from "./services/documentService";
import type { ConnectedService, InsertAgentAction, InsertAutomationRule } from "@shared/schema";

interface ServiceConnection {
  gmail?: any;
  googleCalendar?: any;
  googleDrive?: any;
  // Add other service clients as needed
}

export class AIAgent {
  private userId: string;
  private services: ServiceConnection = {};
  private isRunning = false;

  constructor(userId: string) {
    this.userId = userId;
  }

  async initialize() {
    // Load user's connected services
    const connectedServices = await storage.getConnectedServices(this.userId);
    
    // Initialize service clients
    for (const service of connectedServices) {
      if (service.isActive && service.accessToken) {
        await this.initializeService(service);
      }
    }
  }

  private async initializeService(service: ConnectedService) {
    try {
      switch (service.serviceType) {
        case 'gmail':
          this.services.gmail = await emailService.initialize(service.accessToken);
          break;
        case 'google_calendar':
          this.services.googleCalendar = await calendarService.initialize(service.accessToken);
          break;
        case 'google_drive':
          this.services.googleDrive = await documentService.initialize(service.accessToken);
          break;
      }
    } catch (error) {
      console.error(`Failed to initialize ${service.serviceType}:`, error);
      // Mark service as inactive if auth fails
      await storage.updateConnectedService(service.id, { isActive: false });
    }
  }

  async startAutomation() {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log(`Starting AI automation for user ${this.userId}`);

    // Run automation cycles
    this.scheduleAutomationCycle();
  }

  private scheduleAutomationCycle() {
    // Run every 5 minutes
    setInterval(async () => {
      if (!this.isRunning) return;
      
      try {
        await this.runAutomationCycle();
      } catch (error) {
        console.error('Automation cycle error:', error);
      }
    }, 5 * 60 * 1000);

    // Also run immediately
    this.runAutomationCycle();
  }

  private async runAutomationCycle() {
    console.log(`Running automation cycle for user ${this.userId}`);

    // Email automation
    if (this.services.gmail) {
      await this.processEmails();
    }

    // Calendar automation
    if (this.services.googleCalendar) {
      await this.processCalendar();
    }

    // Document automation
    if (this.services.googleDrive) {
      await this.processDocuments();
    }

    // Learn and adapt patterns
    await this.updateAutomationRules();
  }

  private async processEmails() {
    try {
      const emails = await emailService.getUnreadEmails(this.services.gmail);
      const rules = await storage.getAutomationRules(this.userId, 'email_filter');

      for (const email of emails) {
        // Check for newsletter unsubscribes
        if (await this.isNewsletterCandidate(email)) {
          await this.proposeAction({
            actionType: 'unsubscribe',
            title: `Unsubscribe from ${email.from}`,
            description: `You have ${await this.countEmailsFromSender(email.from)} unread emails from this sender. Would you like to unsubscribe?`,
            actionData: { email, sender: email.from },
            userApprovalRequired: true,
          });
        }

        // Auto-categorize emails
        const category = await this.categorizeEmail(email, rules);
        if (category) {
          await emailService.labelEmail(this.services.gmail, email.id, category);
          
          await this.logAction({
            actionType: 'email_organize',
            title: `Organized email from ${email.from}`,
            description: `Automatically categorized as ${category}`,
            actionData: { emailId: email.id, category },
            userApprovalRequired: false,
            isExecuted: true,
          });
        }

        // Generate auto-responses for routine emails
        if (await this.shouldAutoRespond(email, rules)) {
          const response = await this.generateResponse(email);
          
          await this.proposeAction({
            actionType: 'email_response',
            title: `Auto-response to ${email.from}`,
            description: `Suggested response: "${response.substring(0, 100)}..."`,
            actionData: { emailId: email.id, response },
            userApprovalRequired: true,
          });
        }
      }
    } catch (error) {
      console.error('Email processing error:', error);
    }
  }

  private async processCalendar() {
    try {
      const events = await calendarService.getUpcomingEvents(this.services.googleCalendar);
      
      for (const event of events) {
        // Prepare meeting materials
        if (await this.needsMeetingPrep(event)) {
          await this.proposeAction({
            actionType: 'calendar_manage',
            title: `Prepare for: ${event.summary}`,
            description: 'Gathering relevant documents and agenda items',
            actionData: { eventId: event.id, prepType: 'materials' },
            userApprovalRequired: false,
          });
        }

        // Suggest optimal scheduling
        if (await this.isSuboptimalTiming(event)) {
          await this.proposeAction({
            actionType: 'proactive_suggestion',
            title: `Timing suggestion for ${event.summary}`,
            description: 'This meeting is scheduled during your typical low-energy period. Would you like to suggest rescheduling?',
            actionData: { eventId: event.id, suggestedTime: await this.suggestBetterTime(event) },
            userApprovalRequired: true,
          });
        }
      }
    } catch (error) {
      console.error('Calendar processing error:', error);
    }
  }

  private async processDocuments() {
    try {
      const recentFiles = await documentService.getRecentFiles(this.services.googleDrive);
      
      // Auto-organize documents
      for (const file of recentFiles) {
        const suggestedFolder = await this.suggestDocumentLocation(file);
        if (suggestedFolder && file.parents[0] !== suggestedFolder) {
          await this.proposeAction({
            actionType: 'document_organize',
            title: `Organize: ${file.name}`,
            description: `Move to ${suggestedFolder} folder based on content`,
            actionData: { fileId: file.id, targetFolder: suggestedFolder },
            userApprovalRequired: false,
          });
        }
      }
    } catch (error) {
      console.error('Document processing error:', error);
    }
  }

  private async isNewsletterCandidate(email: any): Promise<boolean> {
    // Check for unsubscribe links and patterns
    const hasUnsubscribeLink = email.body?.includes('unsubscribe') || email.body?.includes('preferences');
    const fromKnownNewsletter = /newsletter|marketing|noreply|donotreply/i.test(email.from);
    const count = await this.countEmailsFromSender(email.from);
    
    return hasUnsubscribeLink && fromKnownNewsletter && count > 5;
  }

  private async countEmailsFromSender(sender: string): Promise<number> {
    return emailService.getEmailCount(this.services.gmail, sender);
  }

  private async categorizeEmail(email: any, rules: any[]): Promise<string | null> {
    // Use AI/ML to categorize emails based on learned patterns
    // For now, simple rule-based categorization
    if (email.subject?.includes('receipt') || email.subject?.includes('invoice')) {
      return 'Finance';
    }
    if (email.from?.includes('github') || email.from?.includes('gitlab')) {
      return 'Development';
    }
    return null;
  }

  private async shouldAutoRespond(email: any, rules: any[]): Promise<boolean> {
    // Check if this is a routine email that can be auto-responded to
    const routinePatterns = ['out of office', 'meeting request', 'confirmation needed'];
    return routinePatterns.some(pattern => 
      email.subject?.toLowerCase().includes(pattern) || 
      email.body?.toLowerCase().includes(pattern)
    );
  }

  private async generateResponse(email: any): Promise<string> {
    // Simple response generation - in production, use AI service
    if (email.subject?.toLowerCase().includes('out of office')) {
      return "Thank you for your email. I'll review this when I return and get back to you shortly.";
    }
    return "Thank you for your email. I'll review this and respond appropriately.";
  }

  private async needsMeetingPrep(event: any): Promise<boolean> {
    const startTime = new Date(event.start.dateTime);
    const hoursUntilMeeting = (startTime.getTime() - Date.now()) / (1000 * 60 * 60);
    return hoursUntilMeeting <= 24 && hoursUntilMeeting > 1;
  }

  private async isSuboptimalTiming(event: any): Promise<boolean> {
    // Check against user's energy patterns
    const userEnergyLogs = await storage.getEnergyLogs(this.userId, 30);
    const eventHour = new Date(event.start.dateTime).getHours();
    
    // Analyze if this time typically correlates with low energy
    const lowEnergyTimes = userEnergyLogs
      .filter(log => log.energyLevel === 'low')
      .map(log => log.timestamp.getHours());
    
    return lowEnergyTimes.includes(eventHour);
  }

  private async suggestBetterTime(event: any): Promise<string> {
    // Suggest time based on user's high-energy periods
    const userEnergyLogs = await storage.getEnergyLogs(this.userId, 30);
    const highEnergyTimes = userEnergyLogs
      .filter(log => log.energyLevel === 'high')
      .map(log => log.timestamp.getHours());
    
    const mostCommonHighEnergyHour = this.getMostCommon(highEnergyTimes);
    return `${mostCommonHighEnergyHour}:00`;
  }

  private getMostCommon(arr: number[]): number {
    return arr.sort((a,b) =>
      arr.filter(v => v === a).length - arr.filter(v => v === b).length
    ).pop() || 10; // Default to 10 AM
  }

  private async suggestDocumentLocation(file: any): Promise<string | null> {
    // AI-based document classification
    const fileName = file.name.toLowerCase();
    
    if (fileName.includes('receipt') || fileName.includes('invoice')) {
      return 'Finance';
    }
    if (fileName.includes('contract') || fileName.includes('agreement')) {
      return 'Legal';
    }
    if (fileName.includes('project') || fileName.includes('spec')) {
      return 'Projects';
    }
    
    return null;
  }

  private async proposeAction(action: Omit<InsertAgentAction, 'userId'>) {
    return storage.createAgentAction({
      ...action,
      userId: this.userId,
    });
  }

  private async logAction(action: Omit<InsertAgentAction, 'userId'>) {
    return storage.createAgentAction({
      ...action,
      userId: this.userId,
    });
  }

  private async updateAutomationRules() {
    // Learn from user's approval/rejection patterns
    const recentActions = await storage.getAgentActions(this.userId, 50);
    
    // Analyze patterns and create/update rules
    const approvedActions = recentActions.filter(action => action.isApproved === true);
    const rejectedActions = recentActions.filter(action => action.isApproved === false);
    
    // Create rules based on approved patterns
    for (const action of approvedActions) {
      await this.learnFromApprovedAction(action);
    }
  }

  private async learnFromApprovedAction(action: any) {
    // Create automation rules based on what user approves
    if (action.actionType === 'unsubscribe') {
      const rule: InsertAutomationRule = {
        userId: this.userId,
        ruleType: 'email_filter',
        name: `Auto-unsubscribe from ${action.actionData.sender}`,
        description: 'Automatically unsubscribe from this sender',
        conditions: { sender: action.actionData.sender, type: 'newsletter' },
        actions: { unsubscribe: true },
        confidence: 80,
        learnedFromUser: true,
      };
      
      await storage.createAutomationRule(rule);
    }
  }

  stop() {
    this.isRunning = false;
  }
}

// Singleton agents per user
const userAgents = new Map<string, AIAgent>();

export function getOrCreateAgent(userId: string): AIAgent {
  if (!userAgents.has(userId)) {
    const agent = new AIAgent(userId);
    userAgents.set(userId, agent);
  }
  return userAgents.get(userId)!;
}

export async function startAgentForUser(userId: string) {
  const agent = getOrCreateAgent(userId);
  await agent.initialize();
  await agent.startAutomation();
  return agent;
}