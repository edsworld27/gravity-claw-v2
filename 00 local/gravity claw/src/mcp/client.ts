import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Tool as AnthropicTool } from "@modelcontextprotocol/sdk/types.js";
import { Tool as AgentTool } from '@anthropic-ai/sdk/resources/messages/messages.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serversConfigPath = path.resolve(__dirname, '../../../data/mcp_servers.json');

interface MCPServerConfig {
    command: string;
    args: string[];
}

interface ServerConnection {
    client: Client;
    tools: AnthropicTool[];
}

export class MCPBridge {
    private connections: Map<string, ServerConnection> = new Map();

    async initialize() {
        console.log('[MCP] Initializing Bridge...');
        if (!fs.existsSync(serversConfigPath)) {
            console.warn('[MCP] No mcp_servers.json found. Skipping MCP setup.');
            return;
        }

        try {
            const configData = JSON.parse(fs.readFileSync(serversConfigPath, 'utf8'));
            const servers = configData.servers as Record<string, MCPServerConfig>;

            for (const [serverName, config] of Object.entries(servers)) {
                console.log(`[MCP] Connecting to server: ${serverName}`);
                await this.connectServer(serverName, config);
            }
        } catch (e) {
            console.error('[MCP] Failed to parse servers config:', e);
        }
    }

    private async connectServer(name: string, config: MCPServerConfig) {
        const transport = new StdioClientTransport({
            command: config.command,
            args: config.args,
        });

        const client = new Client(
            {
                name: "gravity-claw",
                version: "1.0.0",
            },
            {
                capabilities: {
                    prompts: {},
                    resources: {},
                    tools: {},
                } as any, // Bypass strict typing for dynamic MCP capabilities based on sdk version
            }
        );

        try {
            await client.connect(transport);

            // Fetch tools
            const response = await client.listTools();

            this.connections.set(name, {
                client,
                tools: response.tools
            });

            console.log(`[MCP] Connected to ${name}. Loaded ${response.tools.length} tools.`);
        } catch (err: any) {
            console.error(`[MCP] Failed to connect to ${name}:`, err.message);
        }
    }

    public getMappedTools(): AgentTool[] {
        const mapped: AgentTool[] = [];

        for (const [serverName, conn] of this.connections.entries()) {
            for (const tool of conn.tools) {
                // Namespace the tool name to avoid collisions
                mapped.push({
                    name: `mcp_${serverName}_${tool.name}`,
                    description: `[MCP: ${serverName}] ${tool.description || ''}`,
                    input_schema: tool.inputSchema as any
                });
            }
        }
        return mapped;
    }

    public async executeTool(serverName: string, actualToolName: string, args: any): Promise<string> {
        const conn = this.connections.get(serverName);
        if (!conn) throw new Error(`MCP Server ${serverName} not connected.`);

        const response = await conn.client.callTool({
            name: actualToolName,
            arguments: args
        });

        if (response.isError) {
            return `Error from MCP Tool: ${JSON.stringify(response.content)}`;
        }

        // Combine content blocks (text/image) into a single string for Claude's standard response
        const content = response.content as Array<{ type: string, text?: string }>;
        const combined = content.map((c) => {
            if (c.type === 'text' && c.text) return c.text;
            return `[Unsupported MCP content type: ${c.type}]`;
        }).join('\\n');

        return combined;
    }
}
