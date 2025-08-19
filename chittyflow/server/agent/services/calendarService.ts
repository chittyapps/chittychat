import { google } from 'googleapis';

export class CalendarService {
  async initialize(accessToken: string) {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    
    return google.calendar({ version: 'v3', auth });
  }

  async getUpcomingEvents(calendar: any, maxResults = 20) {
    try {
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date().toISOString(),
        maxResults,
        singleEvents: true,
        orderBy: 'startTime',
      });

      return response.data.items || [];
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      throw error;
    }
  }

  async createEvent(calendar: any, event: any) {
    try {
      const response = await calendar.events.insert({
        calendarId: 'primary',
        resource: event,
      });
      return response.data;
    } catch (error) {
      console.error('Error creating event:', error);
      throw error;
    }
  }

  async updateEvent(calendar: any, eventId: string, updates: any) {
    try {
      const response = await calendar.events.update({
        calendarId: 'primary',
        eventId,
        resource: updates,
      });
      return response.data;
    } catch (error) {
      console.error('Error updating event:', error);
      throw error;
    }
  }
}

export const calendarService = new CalendarService();