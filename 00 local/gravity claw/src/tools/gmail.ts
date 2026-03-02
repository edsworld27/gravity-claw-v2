import { gmailService } from '../channels/gmail.js';

export const gmailTools = [
    {
        name: 'gmail_list',
        description: 'List recent unread emails or search for specific emails using a Gmail query string (e.g. "from:boss", "is:unread").',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Gmail search query' },
                maxResults: { type: 'number', description: 'Maximum number of results to return (default 5)' }
            }
        },
        execute: async ({ query, maxResults }: { query?: string, maxResults?: number }) => {
            const messages = await gmailService.listMessages(query, maxResults);
            if (messages.length === 0) return 'No messages found matching your query.';

            const snippets = await Promise.all(messages.map(async (m: any) => {
                const details = await gmailService.getMessage(m.id);
                return `ID: ${m.id} | From: ${details.payload?.headers?.find((h: any) => h.name === 'From')?.value} | Subject: ${details.payload?.headers?.find((h: any) => h.name === 'Subject')?.value} | Snippet: ${details.snippet}`;
            }));
            return snippets.join('\n---\n');
        }
    },
    {
        name: 'gmail_read',
        description: 'Read the full content of a specific email by its ID.',
        parameters: {
            type: 'object',
            properties: {
                id: { type: 'string', description: 'The unique Gmail message ID' }
            },
            required: ['id']
        },
        execute: async ({ id }: { id: string }) => {
            const msg = await gmailService.getMessage(id);
            const body = msg.snippet || 'No snippet available'; // Simplified body extraction for now
            const from = msg.payload?.headers?.find((h: any) => h.name === 'From')?.value;
            const subject = msg.payload?.headers?.find((h: any) => h.name === 'Subject')?.value;
            return `From: ${from}\nSubject: ${subject}\n\nContent Snippet: ${body}\n\n(Full body decoding can be implemented if needed)`;
        }
    },
    {
        name: 'gmail_send',
        description: 'Send a new email to a recipient.',
        parameters: {
            type: 'object',
            properties: {
                to: { type: 'string', description: 'Recipient email address' },
                subject: { type: 'string', description: 'Email subject line' },
                body: { type: 'string', description: 'Plain text email body' }
            },
            required: ['to', 'subject', 'body']
        },
        execute: async ({ to, subject, body }: { to: string, subject: string, body: string }) => {
            await gmailService.sendEmail(to, subject, body);
            return `Successfully sent email to ${to} with subject "${subject}".`;
        }
    }
];
