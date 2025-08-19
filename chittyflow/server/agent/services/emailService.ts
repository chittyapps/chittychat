import { google } from 'googleapis';

export class EmailService {
  async initialize(accessToken: string) {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    
    return google.gmail({ version: 'v1', auth });
  }

  async getUnreadEmails(gmail: any, maxResults = 20) {
    try {
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: 'is:unread',
        maxResults,
      });

      const emails = [];
      if (response.data.messages) {
        for (const message of response.data.messages) {
          const email = await gmail.users.messages.get({
            userId: 'me',
            id: message.id,
            format: 'full',
          });

          const headers = email.data.payload.headers;
          const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
          const from = headers.find((h: any) => h.name === 'From')?.value || '';
          const date = headers.find((h: any) => h.name === 'Date')?.value || '';

          // Extract email body
          let body = '';
          if (email.data.payload.parts) {
            const textPart = email.data.payload.parts.find((part: any) => 
              part.mimeType === 'text/plain'
            );
            if (textPart && textPart.body.data) {
              body = Buffer.from(textPart.body.data, 'base64').toString();
            }
          } else if (email.data.payload.body.data) {
            body = Buffer.from(email.data.payload.body.data, 'base64').toString();
          }

          emails.push({
            id: email.data.id,
            threadId: email.data.threadId,
            subject,
            from,
            date,
            body: body.substring(0, 1000), // Limit body length
            snippet: email.data.snippet,
          });
        }
      }

      return emails;
    } catch (error) {
      console.error('Error fetching emails:', error);
      throw error;
    }
  }

  async getEmailCount(gmail: any, sender: string): Promise<number> {
    try {
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: `from:${sender}`,
        maxResults: 100,
      });

      return response.data.resultSizeEstimate || 0;
    } catch (error) {
      console.error('Error counting emails:', error);
      return 0;
    }
  }

  async labelEmail(gmail: any, messageId: string, label: string) {
    try {
      // First, get or create the label
      let labelId = await this.getLabelId(gmail, label);
      if (!labelId) {
        labelId = await this.createLabel(gmail, label);
      }

      // Apply the label
      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        resource: {
          addLabelIds: [labelId],
        },
      });
    } catch (error) {
      console.error('Error labeling email:', error);
    }
  }

  private async getLabelId(gmail: any, labelName: string): Promise<string | null> {
    try {
      const response = await gmail.users.labels.list({ userId: 'me' });
      const label = response.data.labels.find((l: any) => l.name === labelName);
      return label ? label.id : null;
    } catch (error) {
      console.error('Error getting label:', error);
      return null;
    }
  }

  private async createLabel(gmail: any, labelName: string): Promise<string> {
    try {
      const response = await gmail.users.labels.create({
        userId: 'me',
        resource: {
          name: labelName,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show',
        },
      });
      return response.data.id;
    } catch (error) {
      console.error('Error creating label:', error);
      throw error;
    }
  }

  async sendEmail(gmail: any, to: string, subject: string, body: string) {
    try {
      const message = [
        `To: ${to}`,
        `Subject: ${subject}`,
        '',
        body,
      ].join('\n');

      const encodedMessage = Buffer.from(message).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      await gmail.users.messages.send({
        userId: 'me',
        resource: {
          raw: encodedMessage,
        },
      });
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  async unsubscribeFromSender(gmail: any, email: any) {
    try {
      // Look for unsubscribe links in the email
      const unsubscribePattern = /(https?:\/\/[^\s]+unsubscribe[^\s]*)/gi;
      const matches = email.body.match(unsubscribePattern);
      
      if (matches && matches.length > 0) {
        // Return the unsubscribe URL for user to approve
        return { unsubscribeUrl: matches[0] };
      }

      // Alternative: Add sender to spam/blocked list
      await this.addToSpamFilter(gmail, email.from);
      return { blocked: true };
    } catch (error) {
      console.error('Error unsubscribing:', error);
      throw error;
    }
  }

  private async addToSpamFilter(gmail: any, sender: string) {
    try {
      // Create a filter to automatically delete emails from this sender
      await gmail.users.settings.filters.create({
        userId: 'me',
        resource: {
          criteria: {
            from: sender,
          },
          action: {
            addLabelIds: ['TRASH'],
          },
        },
      });
    } catch (error) {
      console.error('Error adding spam filter:', error);
    }
  }
}

export const emailService = new EmailService();