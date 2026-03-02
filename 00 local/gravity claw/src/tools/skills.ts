import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../');
const SKILLS_DIR = path.join(PROJECT_ROOT, 'skills');

export function listAvailableSkills(): string[] {
    if (!fs.existsSync(SKILLS_DIR)) return [];
    try {
        return fs.readdirSync(SKILLS_DIR).filter(f => f.endsWith('.md'));
    } catch (e) {
        console.error('[Skills] Error listing skills:', e);
        return [];
    }
}

export function getSkillContent(skillName: string): string {
    const filePath = path.join(SKILLS_DIR, skillName.endsWith('.md') ? skillName : `${skillName}.md`);
    if (!fs.existsSync(filePath)) return '';
    try {
        return fs.readFileSync(filePath, 'utf-8');
    } catch (e) {
        console.error(`[Skills] Error reading skill ${skillName}:`, e);
        return '';
    }
}

export const skillTools = [
    {
        name: 'skill_list',
        description: 'List all available skills (SOPs/Workflows) that the agent can execute.',
        parameters: { type: 'object', properties: {} },
        execute: async () => {
            const skills = listAvailableSkills();
            return skills.length > 0
                ? `Available skills:\n${skills.map(s => `- ${s}`).join('\n')}`
                : "No skills registered yet. Add .md files to the /skills folder.";
        }
    },
    {
        name: 'skill_execute',
        description: 'Read and follow the instructions in a specific skill Markdown file.',
        parameters: {
            type: 'object',
            properties: {
                skillName: { type: 'string', description: 'The name of the skill file (e.g., "deploy" for "deploy.md")' }
            },
            required: ['skillName']
        },
        execute: async ({ skillName }: any) => {
            const content = getSkillContent(skillName);
            if (!content) return `Skill "${skillName}" not found.`;
            return `### Executing Skill: ${skillName}\n\n${content}\n\n[Instruction]: Please follow the steps above carefully.`;
        }
    }
];
