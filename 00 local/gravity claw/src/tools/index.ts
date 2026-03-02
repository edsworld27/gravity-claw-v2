import { Tool } from '@anthropic-ai/sdk/resources/messages/messages.js';
import { timeTools } from './time.js';
import { memoryTools } from './memory.js';
import { gmailTools } from './gmail.js';
import { memoryPlusTools } from './memory_plus.js';
import { spotifyTools } from './spotify.js';
import { calendarTools } from './calendar.js';
import { weatherTools } from './weather.js';
import { newsTools } from './news.js';
import { homeAssistantTools } from './home_assistant.js';
import { researchTools } from './research.js';
import { documentTools } from './document_parser.js';
import { habitTools } from './habits.js';
import { markdownMemoryTools } from './markdown_memory.js';
import { evolutionTools } from './evolution.js';
import { skillTools } from './skills.js';
import { swarmTools } from './swarm.js';
import { sandboxTools } from './sandbox.js';
import { braveSearchTools } from './brave_search.js';
import { pluginManager } from '../agent/plugins.js';
import { MCPBridge } from '../mcp/client.js';
import { config } from '../config.js';
import { SupabaseLogger } from '../db/supabase.js';
import fs from 'fs';
import path from 'path';

export class ToolRegistry {
    private tools: Map<string, any> = new Map();
    private mcpBridge: MCPBridge;
    private sensitiveTools = new Set(['shell_execute', 'code_sandbox_execute', 'memory_prune', 'memory_merge']);

    constructor() {
        this.mcpBridge = new MCPBridge();

        // Register built-in tools
        [
            ...timeTools,
            ...memoryTools,
            ...gmailTools,
            ...memoryPlusTools,
            ...spotifyTools,
            ...calendarTools,
            ...weatherTools,
            ...newsTools,
            ...homeAssistantTools,
            ...researchTools,
            ...documentTools,
            ...habitTools,
            ...markdownMemoryTools,
            ...evolutionTools,
            ...skillTools,
            ...swarmTools,
            ...sandboxTools,
            ...braveSearchTools,
            ...pluginManager.getPluginTools()
        ].forEach(tool => {
            this.tools.set(tool.name, tool);
        });
    }

    async initialize() {
        await this.mcpBridge.initialize();
    }

    getTools(): Tool[] {
        const builtInDefinitions = Array.from(this.tools.values()).map(t => t.definition || t);
        const mcpDefinitions = this.mcpBridge.getMappedTools();
        return [...builtInDefinitions, ...mcpDefinitions];
    }

    async executeTool(name: string, args: any, senderId?: string): Promise<string> {
        // Feature: Mission Control Dashboard Toggles (Supabase & JSON Fallback)
        try {
            let connections = await SupabaseLogger.getConfig('connections');

            if (!connections) {
                const connectionsPath = path.resolve(process.cwd(), 'data/connections.json');
                if (fs.existsSync(connectionsPath)) {
                    connections = JSON.parse(fs.readFileSync(connectionsPath, 'utf8'));
                }
            }

            if (connections) {
                const blockedConnection = connections.find((c: any) =>
                    c.status === 'Inactive' &&
                    c.tools?.includes(name)
                );

                if (blockedConnection) {
                    // Feature: Proactive Reporting
                    if (senderId) {
                        await SupabaseLogger.logEvent('system', 'internal', senderId, `Blocked attempt to use "${name}" (Connection: ${blockedConnection.name} is Inactive)`);
                    }
                    return `Access Denied: The "${blockedConnection.name}" connection is currently inactive in Mission Control. If you need this, please enable it in the dashboard.`;
                }

                // Feature: Fail-Secure (Don't allow bypassing what isn't explicitly active if it's an external tool)
                const isExternal = (config.externalTools as Set<string>).has(name);
                if (isExternal) {
                    const activeConn = connections.find((c: any) => c.status === 'Active' && c.tools?.includes(name));
                    if (!activeConn) {
                        if (senderId) {
                            await SupabaseLogger.logEvent('system', 'internal', senderId, `Blocked attempt to use unauthorized external tool: "${name}"`);
                        }
                        return `Access Denied: The tool "${name}" is not part of an active connection and has been blocked for security.`;
                    }
                }
            }
        } catch (error) {
            console.error('[Registry] Failed to check connection status:', error);
        }

        // Feature 42: Command Allowlists
        if (this.sensitiveTools.has(name)) {
            const adminId = String(config.telegramUserId);
            if (senderId && String(senderId) !== adminId) {
                return `Access Denied: Tool "${name}" is restricted to administrators.`;
            }
        }

        // Feature 44: Air-Gapped Mode
        if (config.airGappedMode && (config.externalTools as Set<string>).has(name)) {
            return `Access Denied: Tool "${name}" is blocked in Air-Gapped Mode.`;
        }

        const tool = this.tools.get(name);
        if (tool) {
            try {
                return await tool.execute(args);
            } catch (error) {
                return `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`;
            }
        }

        // Try MCP
        if (name.startsWith('mcp_')) {
            const parts = name.split('_');
            if (parts.length >= 3) {
                const serverName = parts[1];
                const actualToolName = parts.slice(2).join('_');
                return await this.mcpBridge.executeTool(serverName, actualToolName, args);
            }
        }

        throw new Error(`Tool ${name} not found.`);
    }

    getToolDefinitions(): any[] {
        const builtInDefinitions = Array.from(this.tools.values()).map(t => t.definition || t);
        const mcpDefinitions = this.mcpBridge.getMappedTools();
        return [...builtInDefinitions, ...mcpDefinitions];
    }
}

export const toolRegistry = new ToolRegistry();
