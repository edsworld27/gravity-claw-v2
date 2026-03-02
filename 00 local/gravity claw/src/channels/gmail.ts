import { google } from 'googleapis';
import { config } from '../config.js';
import fs from 'fs';
import path from 'path';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.modify'];
const TOKEN_PATH = path.join(process.cwd(), 'data', 'gmail_tokens.json');

export class GmailService {
    private oauth2Client: any;
    private static instance: GmailService;

    private constructor() {
        this.oauth2Client = new google.auth.OAuth2(
            config.gmailClientId,
            config.gmailClientSecret,
            config.gmailRedirectUri
        );
    }

    public static getInstance(): GmailService {
        if (!GmailService.instance) {
            GmailService.instance = new GmailService();
        }
        return GmailService.instance;
    }

    public async initialize() {
        if (!config.gmailClientId || !config.gmailClientSecret) {
            console.log('[Gmail] Skipping initialization (missing Client ID/Secret)');
            return;
        }

        if (fs.existsSync(TOKEN_PATH)) {
            const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
            this.oauth2Client.setCredentials(tokens);
            console.log('[Gmail] Loaded tokens from storage');

            // Refresh token as well
            this.oauth2Client.on('tokens', (tokens: any) => {
                if (tokens.refresh_token) {
                    // store the refresh_token in your local store
                    console.log('[Gmail] New refresh token received');
                }
                console.log('[Gmail] Access token refreshed');
            });
        } else {
            const authUrl = this.oauth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: SCOPES,
            });
            console.log('[Gmail] ⚠️ Action required: Authorize this app by visiting this url:', authUrl);
            console.log('[Gmail] After authorizing, call saveGmailToken(code) with the code from the redirect URL.');
        }
    }

    public async saveToken(code: string) {
        const { tokens } = await this.oauth2Client.getToken(code);
        this.oauth2Client.setCredentials(tokens);
        fs.mkdirSync(path.dirname(TOKEN_PATH), { recursive: true });
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
        console.log('[Gmail] Token saved to', TOKEN_PATH);
    }

    public getGmailClient() {
        return google.gmail({ version: 'v1', auth: this.oauth2Client });
    }

    public async listMessages(q: string = 'label:INBOX is:unread', maxResults: number = 5) {
        const gmail = this.getGmailClient();
        const res = await gmail.users.messages.list({
            userId: 'me',
            q,
            maxResults
        });
        return res.data.messages || [];
    }

    public async getMessage(id: string) {
        const gmail = this.getGmailClient();
        const res = await gmail.users.messages.get({
            userId: 'me',
            id
        });
        return res.data;
    }

    public async sendEmail(to: string, subject: string, body: string) {
        const gmail = this.getGmailClient();
        const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
        const messageParts = [
            `From: Gravity Claw Bot <${config.gmailClientId}>`,
            `To: ${to}`,
            'Content-Type: text/plain; charset=utf-8',
            'MIME-Version: 1.0',
            `Subject: ${utf8Subject}`,
            '',
            body,
        ];
        const message = messageParts.join('\n');
        const encodedMessage = Buffer.from(message)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedMessage,
            },
        });
        console.log('[Gmail] Email sent to', to);
    }
}

export const gmailService = GmailService.getInstance();
