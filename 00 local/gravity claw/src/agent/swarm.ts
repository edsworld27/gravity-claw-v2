import { MessageParam } from '@anthropic-ai/sdk/resources/messages/messages.js';
import { providerManager } from '../providers/manager.js';
import { ToolRegistry } from '../tools/index.js';

export interface SwarmAgentConfig {
    name: string;
    role: string;
    instructions: string;
    tools?: string[]; // List of allowed tools
}

export class SwarmManager {
    /**
     * Spawns a sub-agent to handle a specific task and returns its final response.
     */
    public static async spawnAndRun(
        parentTask: string,
        config: SwarmAgentConfig,
        parentHistory: MessageParam[] = []
    ): Promise<string> {
        console.log(`[Swarm] Spawning sub-agent: ${config.name} (${config.role})...`);

        const systemPrompt = `
You are a specialized sub-agent named ${config.name}. 
Role: ${config.role}
Instructions: ${config.instructions}
Parent Task: ${parentTask}

You are working on behalf of a primary agent. Provide a concise summary of your findings or or actions taken.
        `;

        const messages: MessageParam[] = [
            ...parentHistory.slice(-5), // Give some limited context
            { role: 'user', content: `Please execute the following task: ${parentTask}` }
        ];

        // For simplicity, sub-agents use a fresh tool registry or the same one
        const subRegistry = new ToolRegistry();

        let iteration = 0;
        const maxIterations = 5;

        while (iteration < maxIterations) {
            iteration++;
            const response = await providerManager.createMessage(messages, systemPrompt, subRegistry.getToolDefinitions());

            messages.push({ role: 'assistant', content: response.text });

            if (response.stopReason === 'tool_use' && response.toolCalls) {
                const results = [];
                for (const toolUse of response.toolCalls) {
                    console.log(`[Swarm:${config.name}] Executing ${toolUse.name}...`);
                    const result = await subRegistry.executeTool(toolUse.name, toolUse.input);
                    results.push({
                        type: 'tool_result' as const,
                        tool_use_id: toolUse.id,
                        content: result
                    });
                }
                messages.push({ role: 'user', content: results as any });
            } else {
                return response.text;
            }
        }

        return "Sub-agent reached maximum iterations without finishing.";
    }

    /**
     * Runs multiple specialized tasks in parallel and returns a combined report.
     */
    public static async runParallel(
        objective: string,
        agents: SwarmAgentConfig[],
        parentHistory: MessageParam[] = []
    ): Promise<string> {
        console.log(`[Mesh] Starting parallel objective: ${objective}`);

        const results = await Promise.all(agents.map(agent =>
            this.spawnAndRun(`Objective: ${objective}\nYour Specific Part: ${agent.instructions}`, agent, parentHistory)
                .catch(err => `Agent ${agent.name} failed: ${err.message}`)
        ));

        let report = `## Mesh Workflow Report: ${objective}\n\n`;
        agents.forEach((agent, i) => {
            report += `### ${agent.name} (${agent.role})\n${results[i]}\n\n`;
        });

        return report;
    }
}
