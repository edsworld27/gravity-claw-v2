import { Tool } from '@anthropic-ai/sdk/resources/messages/messages.js';

export interface AgentPlugin {
    name: string;
    description: string;
    tools: { name: string; definition: Tool; execute: (args: any) => Promise<string> }[];
    systemPromptAddition?: string;
}

export class PluginManager {
    private plugins: Map<string, AgentPlugin> = new Map();

    registerPlugin(plugin: AgentPlugin) {
        console.log(`[Plugins] Registering plugin: ${plugin.name}`);
        this.plugins.set(plugin.name, plugin);
    }

    getAllPlugins(): AgentPlugin[] {
        return Array.from(this.plugins.values());
    }

    getPluginTools(): any[] {
        return this.getAllPlugins().flatMap(p => p.tools);
    }

    getPluginSystemPrompts(): string {
        return this.getAllPlugins()
            .map(p => p.systemPromptAddition)
            .filter(Boolean)
            .join('\n\n');
    }
}

export const pluginManager = new PluginManager();
