import { calendarService } from '../channels/calendar.js';

export const calendarTools = [
    {
        name: 'calendar_list',
        description: 'List upcoming events from your Google Calendar.',
        parameters: {
            type: 'object',
            properties: {
                maxResults: { type: 'number', description: 'Maximum number of events to list (default 10)' }
            }
        },
        execute: async ({ maxResults }: { maxResults?: number }) => {
            const events = await calendarService.listEvents(maxResults);
            if (events.length === 0) return 'No upcoming events found.';

            const eventList = events.map((e: any) => {
                const start = e.start.dateTime || e.start.date;
                return `${start} - ${e.summary} (${e.id})`;
            });
            return `Upcoming events:\n${eventList.join('\n')}`;
        }
    },
    {
        name: 'calendar_create',
        description: 'Create a new event on your Google Calendar.',
        parameters: {
            type: 'object',
            properties: {
                summary: { type: 'string', description: 'Event title' },
                description: { type: 'string', description: 'Event description' },
                start: { type: 'string', description: 'Start time (ISO format, e.g. 2024-03-01T09:00:00Z)' },
                end: { type: 'string', description: 'End time (ISO format, e.g. 2024-03-01T10:00:00Z)' }
            },
            required: ['summary', 'start', 'end']
        },
        execute: async ({ summary, description, start, end }: any) => {
            const event = await calendarService.createEvent(summary, description || '', start, end);
            return `Successfully created event: ${event.summary} (${event.htmlLink})`;
        }
    }
];
