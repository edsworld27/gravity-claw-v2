import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../');
const MEMORIES_DIR = path.join(PROJECT_ROOT, 'memories');

export function getMarkdownBrain(senderId: string): string {
    const filePath = path.join(MEMORIES_DIR, senderId, 'facts.md');
    if (!fs.existsSync(filePath)) return '';
    try {
        return fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
        console.error(`[MarkdownMemory] Error reading brain for ${senderId}:`, error);
        return '';
    }
}

export const markdownMemoryTools = [
    {
        name: 'md_save_fact',
        description: 'Save a permanent, human-readable fact about the user or their preferences to a Markdown file.',
        parameters: {
            type: 'object',
            properties: {
                fact: { type: 'string', description: 'The fact to remember (e.g., "The user prefers dark mode.")' },
                senderId: { type: 'string', description: 'User identifier' }
            },
            required: ['fact']
        },
        execute: async ({ fact, senderId = 'default' }: any) => {
            const userDir = path.join(MEMORIES_DIR, senderId);
            const filePath = path.join(userDir, 'facts.md');

            try {
                if (!fs.existsSync(userDir)) {
                    fs.mkdirSync(userDir, { recursive: true });
                }

                const timestamp = new Date().toISOString().split('T')[0];
                const entry = `- [${timestamp}] ${fact}\n`;

                fs.appendFileSync(filePath, entry);
                return `Fact saved to your Markdown brain: "${fact}"`;
            } catch (error: any) {
                return `Error saving to Markdown brain: ${error.message}`;
            }
        }
    },
    {
        name: 'md_read_brain',
        description: 'Read all permanent facts stored in the Markdown brain for the current user.',
        parameters: {
            type: 'object',
            properties: {
                senderId: { type: 'string', description: 'User identifier' }
            }
        },
        execute: async ({ senderId = 'default' }: any) => {
            const brain = getMarkdownBrain(senderId);
            return brain ? `### Markdown Brain Contents:\n${brain}` : "Your Markdown brain is currently empty.";
        }
    }
];
