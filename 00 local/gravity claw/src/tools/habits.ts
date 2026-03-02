import { db } from '../db/index.js';

export const habitTools = [
    {
        name: 'habit_create',
        description: 'Create a new habit or goal to track (e.g., "Drink 2L water daily").',
        parameters: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Name of the habit' },
                description: { type: 'string', description: 'Detailed description of the goal' },
                frequency: { type: 'string', enum: ['daily', 'weekly'], description: 'How often to track' },
                goal_count: { type: 'number', description: 'Target count per frequency' },
                senderId: { type: 'string', description: 'User identifier (usually provided by context)' },
                platform: { type: 'string', description: 'Platform identifier (usually provided by context)' }
            },
            required: ['name']
        },
        execute: async ({ name, description = '', frequency = 'daily', goal_count = 1, senderId = 'default', platform = 'unknown' }: any) => {
            try {
                const stmt = db.prepare(`
                    INSERT INTO habits (sender_id, platform, name, description, frequency, goal_count)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(sender_id, platform, name) DO UPDATE SET
                    description = excluded.description,
                    frequency = excluded.frequency,
                    goal_count = excluded.goal_count
                `);
                stmt.run(senderId, platform, name, description, frequency, goal_count);
                return `Habit "${name}" created/updated successfully. I'll help you track your progress!`;
            } catch (error: any) {
                return `Error creating habit: ${error.message}`;
            }
        }
    },
    {
        name: 'habit_log',
        description: 'Record an instance of a habit being completed.',
        parameters: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Name of the habit' },
                count: { type: 'number', description: 'Amount to add (default 1)' },
                senderId: { type: 'string', description: 'User identifier' },
                platform: { type: 'string', description: 'Platform identifier' }
            },
            required: ['name']
        },
        execute: async ({ name, count = 1, senderId = 'default', platform = 'unknown' }: any) => {
            try {
                const stmt = db.prepare(`
                    UPDATE habits 
                    SET current_count = current_count + ?, 
                        last_logged = CURRENT_TIMESTAMP
                    WHERE sender_id = ? AND platform = ? AND name = ?
                `);
                const result = stmt.run(count, senderId, platform, name);
                if (result.changes === 0) return `Habit "${name}" not found. Create it first using 'habit_create'.`;

                const status = db.prepare('SELECT current_count, goal_count FROM habits WHERE sender_id = ? AND platform = ? AND name = ?').get(senderId, platform, name) as any;
                return `Logged! Current progress for "${name}": ${status.current_count}/${status.goal_count}.`;
            } catch (error: any) {
                return `Error logging habit: ${error.message}`;
            }
        }
    },
    {
        name: 'habit_status',
        description: 'Get a summary of all active habits and their current progress.',
        parameters: {
            type: 'object',
            properties: {
                senderId: { type: 'string' },
                platform: { type: 'string' }
            }
        },
        execute: async ({ senderId = 'default', platform = 'unknown' }: any) => {
            try {
                const habits = db.prepare('SELECT name, current_count, goal_count, frequency FROM habits WHERE sender_id = ? AND platform = ?').all(senderId, platform) as any[];
                if (habits.length === 0) return "You haven't set any habits yet! Use 'habit_create' to get started.";

                const list = habits.map(h => `- **${h.name}**: ${h.current_count}/${h.goal_count} (${h.frequency})`).join('\n');
                return `Current Habit Status:\n${list}`;
            } catch (error: any) {
                return `Error fetching habits: ${error.message}`;
            }
        }
    }
];
