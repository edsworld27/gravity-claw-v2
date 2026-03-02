import { SwarmManager } from '../agent/swarm.js';

export const swarmTools = [
    {
        name: 'delegate_task',
        description: 'Delegate a complex task to a specialized sub-agent (e.g., researcher, coder, analyst).',
        parameters: {
            type: 'object',
            properties: {
                agentRole: { type: 'string', description: 'The role of the sub-agent (e.g., "Researcher", "Python Expert")' },
                taskDescription: { type: 'string', description: 'Detailed description of the task to perform.' },
                instructions: { type: 'string', description: 'Specific instructions for the sub-agent.' }
            },
            required: ['agentRole', 'taskDescription', 'instructions']
        },
        execute: async ({ agentRole, taskDescription, instructions }: any) => {
            try {
                const result = await SwarmManager.spawnAndRun(taskDescription, {
                    name: `SubAgent-${agentRole}`,
                    role: agentRole,
                    instructions: instructions
                });
                return `### Result from ${agentRole}:\n\n${result}`;
            } catch (error: any) {
                return `Delegation failed: ${error.message}`;
            }
        }
    },
    {
        name: 'mesh_run',
        description: 'Coordinate multiple specialized agents in parallel to achieve a complex objective.',
        parameters: {
            type: 'object',
            properties: {
                objective: { type: 'string', description: 'The overall goal.' },
                agents: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            name: { type: 'string' },
                            role: { type: 'string' },
                            instructions: { type: 'string', description: 'What this specific agent should do.' }
                        },
                        required: ['name', 'role', 'instructions']
                    }
                }
            },
            required: ['objective', 'agents']
        },
        execute: async ({ objective, agents }: any) => {
            try {
                return await SwarmManager.runParallel(objective, agents);
            } catch (error: any) {
                return `Mesh execution failed: ${error.message}`;
            }
        }
    }
];
