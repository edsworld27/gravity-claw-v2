import { Tool } from '@anthropic-ai/sdk/resources/messages/messages.js';
import { db } from '../db/index.js';

export const saveMemoryToolDefinition: Tool = {
    name: 'save_memory',
    description: 'Save an important fact about the user or instructions to long-term explicit memory.',
    input_schema: {
        type: 'object',
        properties: {
            fact: {
                type: 'string',
                description: 'The explicit fact or instruction to remember permanently. Be concise.'
            }
        },
        required: ['fact']
    }
};

export const searchHistoryToolDefinition: Tool = {
    name: 'search_history',
    description: 'Search past conversational history for specific topics or keywords.',
    input_schema: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'The keyword or phrase to search for.'
            }
        },
        required: ['query']
    }
};

export function saveMemoryExecutor(fact: string): string {
    try {
        const stmt = db.prepare('INSERT OR IGNORE INTO explicit_memories (fact) VALUES (?)');
        const result = stmt.run(fact);
        if (result.changes === 0) {
            return `Fact was already in memory: ${fact}`;
        }
        return `Successfully saved memory: ${fact}`;
    } catch (err: any) {
        return `Failed to save memory: ${err.message}`;
    }
}

export function searchHistoryExecutor(query: string): string {
    const stmt = db.prepare(`
        SELECT content, timestamp FROM messages_fts 
        JOIN messages ON messages.id = messages_fts.rowid
        WHERE messages_fts.content MATCH ? 
        ORDER BY rank LIMIT 5
    `);

    // SQLite FTS5 requires quotes around search terms if they contain special characters
    // Simple sanitization for safety
    const safeQuery = `"${query.replace(/"/g, '""')}"`;

    try {
        const rows = stmt.all(safeQuery) as { content: string, timestamp: string }[];
        if (rows.length === 0) return "No matching history found.";
        return rows.map(r => `[${r.timestamp}] ${r.content}`).join('\\n');
    } catch (err: any) {
        return `Search failed: ${err.message}`;
    }
}

export function getAllMemories(): string[] {
    const stmt = db.prepare('SELECT fact FROM explicit_memories ORDER BY id ASC');
    const rows = stmt.all() as { fact: string }[];
    return rows.map(r => r.fact);
}

export const memoryTools = [
    {
        name: saveMemoryToolDefinition.name,
        definition: saveMemoryToolDefinition,
        execute: (args: any) => saveMemoryExecutor(args.fact)
    },
    {
        name: searchHistoryToolDefinition.name,
        definition: searchHistoryToolDefinition,
        execute: (args: any) => searchHistoryExecutor(args.query)
    }
];
