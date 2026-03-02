import { google } from 'googleapis';
import { config } from '../config.js';
import fs from 'fs';
import path from 'path';

const SCOPES = ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.readonly'];
const TOKEN_PATH = path.join(process.cwd(), 'data', 'calendar_tokens.json');

export class CalendarService {
    private oauth2Client: any;
    private static instance: CalendarService;

    private constructor() {
        this.oauth2Client = new google.auth.OAuth2(
            config.calendarClientId,
            config.calendarClientSecret,
            'http://localhost:3000/oauth2callback'
        );
    }

    public static getInstance(): CalendarService {
        if (!CalendarService.instance) {
            CalendarService.instance = new CalendarService();
        }
        return CalendarService.instance;
    }

    public async initialize() {
        if (!config.calendarClientId || !config.calendarClientSecret) {
            console.log('[Calendar] Skipping initialization (missing Client ID/Secret)');
            return;
        }

        if (fs.existsSync(TOKEN_PATH)) {
            const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
            this.oauth2Client.setCredentials(tokens);
            console.log('[Calendar] Loaded tokens from storage');
        } else {
            const authUrl = this.oauth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: SCOPES,
            });
            console.log('[Calendar] ⚠️ Action required: Authorize this app by visiting this url:', authUrl);
        }
    }

    public async saveToken(code: string) {
        const { tokens } = await this.oauth2Client.getToken(code);
        this.oauth2Client.setCredentials(tokens);
        fs.mkdirSync(path.dirname(TOKEN_PATH), { recursive: true });
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
        console.log('[Calendar] Token saved to', TOKEN_PATH);
    }

    public getCalendarClient() {
        return google.calendar({ version: 'v3', auth: this.oauth2Client });
    }

    public async listEvents(maxResults: number = 10) {
        const calendar = this.getCalendarClient();
        const res = await calendar.events.list({
            calendarId: 'primary',
            timeMin: new Date().toISOString(),
            maxResults,
            singleEvents: true,
            orderBy: 'startTime',
        });
        return res.data.items || [];
    }

    public async createEvent(summary: string, description: string, start: string, end: string) {
        const calendar = this.getCalendarClient();
        const event = {
            summary,
            description,
            start: { dateTime: start, timeZone: 'UTC' },
            end: { dateTime: end, timeZone: 'UTC' },
        };
        const res = await calendar.events.insert({
            calendarId: 'primary',
            requestBody: event,
        });
        return res.data;
    }
}

export const calendarService = CalendarService.getInstance();
