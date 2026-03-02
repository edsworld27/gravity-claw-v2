import { toolRegistry } from './tools/index.js';
import { MessageParam } from '@anthropic-ai/sdk/resources/messages/messages.js';
import { getRecentHistory, saveMessage, db } from './db/index.js';
import { SupabaseLogger } from './db/supabase.js';
import { getAllMemories } from './tools/memory.js';
import { providerManager } from './providers/manager.js';
import { pluginManager } from './agent/plugins.js';
import { getMarkdownBrain } from './tools/markdown_memory.js';
import { config } from './config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import {
    buildStructuredPrompt,
    buildInternalPrompt,
    wrapToolOutput,
    detectInjectionAttempts,
    sanitizeForLogging,
    agentKeyRegistry,
    type AgentKeyMetadata,
    type ConversationMessage
} from './security/index.js';

// Session initialization: Load SOUL.md and USER.md for lean context
let soulContext = '';
let userContext = '';

function loadSessionContext(): void {
    const dataDir = path.join(__dirname, '../data');

    // Load SOUL.md (agent identity)
    const soulPath = path.join(dataDir, 'SOUL.md');
    if (fs.existsSync(soulPath)) {
        soulContext = fs.readFileSync(soulPath, 'utf8');
        console.log('[Session] Loaded SOUL.md');
    }

    // Load USER.md (operator profile)
    const userPath = path.join(dataDir, 'USER.md');
    if (fs.existsSync(userPath)) {
        userContext = fs.readFileSync(userPath, 'utf8');
        console.log('[Session] Loaded USER.md');
    }
}

// Load context at module initialization
loadSessionContext();

// Core system instructions (trusted content)
const CORE_SYSTEM_INSTRUCTIONS = `
You are Gravity Claw, a powerful, personal AI agent.
You communicate concisely and helpfully.
Use tools when appropriate. If you need to know the current time, use the get_current_time tool.

### Memory Systems
- **Explicit Memory**: Key facts you've been told to remember.
- **Knowledge Graph**: Structured relationships between people, places, and things (Triplets).
- **Search History**: Keyword-based search of raw chat logs.
- **Semantic Search (RAG)**: Find memories by concept/meaning.
- **Productivity**: Access to Spotify (music) and Google Calendar (schedule).
- **Environment**: Access to Weather (OpenWeatherMap), News (NewsAPI), and Smart Home (Home Assistant).
- **Intelligence**: Access to Research (Puppeteer scraping) and Document analysis (PDF parsing).

**Search & Action Priority**:
1. Check Explicit Memory below.
2. Use \`calendar_list\` for schedule queries.
3. For complex research questions, use \`deep_research\` (which may lead you to search and scrape).
4. Use \`scrape_page\` to read modern web pages that require JavaScript.
5. Use \`spotify_current_track\` for music questions.
6. Use \`ha_list_entities\` for home status.
7. Use \`kg_query\` for specific entities or relationships.
8. Use \`semantic_search\` for general context or concepts.
9. Use \`search_history\` for exact quotes or keywords.

**Saving & Control Priority**:
- Use \`ingest_document\` to save PDFs into long-term Vector Memory.
- Use \`calendar_create\` for new appointments.
- Use \`ha_control_device\` for smart home adjustments.
- Use \`kg_save\` for structured facts.
- Use \`save_memory\` for explicit instructions.
`.trim();

// Current agent key for this session (set during initialization)
let currentAgentKey: AgentKeyMetadata | undefined;

/**
 * Initialize or get the agent key for this instance
 */
export function initializeAgentKey(name: string = 'gravity-claw-main'): AgentKeyMetadata {
    // Check if we already have an active key for this agent
    const existingKeys = agentKeyRegistry.getActiveKeys();
    const existing = existingKeys.find(k => k.name === name);

    if (existing) {
        currentAgentKey = existing;
        console.log(`[Agent] Using existing agent key: ${existing.keyId.substring(0, 30)}...`);
        return existing;
    }

    // Generate a new key for this agent
    const newKey = agentKeyRegistry.generateKey(name, {
        canAccessOpenAI: true,
        canAccessAnthropic: true,
        canAccessOpenRouter: true,
        canAccessOllama: true,
        canExecuteTools: true,
        canAccessMemory: true,
        canAccessExternalAPIs: true
    });

    currentAgentKey = newKey;
    console.log(`[Agent] Generated new agent key: ${newKey.keyId.substring(0, 30)}...`);
    return newKey;
}

/**
 * Get the current agent key
 */
export function getAgentKey(): AgentKeyMetadata | undefined {
    return currentAgentKey;
}

/**
 * Build a secure, structured system prompt with XML boundaries
 */
const getSystemPrompt = (senderId: string = 'default', conversationHistory?: ConversationMessage[]) => {
    const explicitMemories = getAllMemories().join('\n- ');
    const kb = getMarkdownBrain(senderId);
    const pluginPrompts = pluginManager.getPluginSystemPrompts();

    // Build the full system context with lean session initialization
    const fullSystemPrompt = `${soulContext ? `### Agent Identity\n${soulContext}\n\n` : ''}${userContext ? `### Operator Profile\n${userContext}\n\n` : ''}${CORE_SYSTEM_INSTRUCTIONS}

### Explicit User Facts:
- ${explicitMemories || 'No saved memories yet.'}

### Permanent Markdown Brain:
${kb}

${pluginPrompts}`;

    // Use the structured prompt builder with XML boundaries
    return buildStructuredPrompt({
        systemPrompt: fullSystemPrompt,
        agentKey: currentAgentKey,
        conversationHistory: conversationHistory,
        additionalContext: undefined
    });
}

const MAX_ITERATIONS = 5;
let reasoningMode = false;

async function runAgentLoop(messages: MessageParam[], senderId: string, platform: string, attachments?: any[]): Promise<string> {
    let iterations = 0;

    // Check for injection attempts in user messages and log warnings
    for (const msg of messages) {
        if (msg.role === 'user' && typeof msg.content === 'string') {
            const injection = detectInjectionAttempts(msg.content);
            if (injection.detected) {
                console.warn(`[Security] Potential injection detected from ${senderId}: ${injection.indicators.join(', ')}`);
                SupabaseLogger.logEvent('security_warning', platform, senderId, 'Potential prompt injection detected', {
                    indicators: injection.indicators
                }).catch(() => { });
            }
        }
    }

    if (attachments && attachments.length > 0 && messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.role === 'user') {
            const contentBlocks: any[] = [];
            if (typeof lastMessage.content === 'string') {
                contentBlocks.push({ type: 'text', text: lastMessage.content });
            } else if (Array.isArray(lastMessage.content)) {
                contentBlocks.push(...lastMessage.content);
            }

            attachments.forEach(att => {
                if (att.type === 'image') {
                    contentBlocks.push({
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: att.media_type,
                            data: att.data
                        }
                    });
                }
            });
            lastMessage.content = contentBlocks;
        }
    }

    // Convert messages to ConversationMessage format for XML structure
    const conversationHistory: ConversationMessage[] = messages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        timestamp: Date.now()
    }));

    while (iterations < MAX_ITERATIONS) {
        iterations++;
        console.log(`[Agent] Iteration ${iterations}`);

        // Build structured system prompt with XML boundaries
        const structuredSystemPrompt = getSystemPrompt(senderId, conversationHistory);

        const response = await providerManager.createMessage(
            messages,
            structuredSystemPrompt,
            toolRegistry.getTools()
        );

        messages.push({
            role: 'assistant',
            content: response.text || (response.toolCalls ? 'Using tools...' : '')
        });

        if (response.stopReason === 'tool_use' && response.toolCalls) {
            const toolResultsArray: any[] = [];

            for (const toolCall of response.toolCalls) {
                if (toolCall.type !== 'tool_use') continue;
                console.log(`[Agent] Tool called: ${toolCall.name}`);
                try {
                    const result = await toolRegistry.executeTool(toolCall.name, toolCall.input, senderId);
                    toolResultsArray.push({
                        type: 'tool_result',
                        tool_use_id: toolCall.id,
                        content: result
                    });
                } catch (error) {
                    toolResultsArray.push({
                        type: 'tool_result',
                        tool_use_id: toolCall.id,
                        content: `Error executing tool: ${(error as any).message}`
                    });
                }
            }

            // Log tool results back to activity log
            SupabaseLogger.logEvent('tool_call', platform, senderId, `Executed ${response.toolCalls.length} tools`, {
                tools: response.toolCalls.map(tc => tc.name)
            }).catch(() => { });

            messages.push({
                role: 'user',
                content: toolResultsArray
            });
        } else {
            const finalResponse = response.text || "No text response generated.";
            saveMessage('assistant', finalResponse, senderId, platform, response.usage);

            // Log assistant message to Supabase
            SupabaseLogger.logEvent('message', platform, senderId, finalResponse, { role: 'assistant', usage: response.usage }).catch(() => { });

            // Feature 40: Smart Recommendations
            const suggestions = RecommendationEngine.suggest(finalResponse);
            if (suggestions.length > 0) {
                return `${finalResponse}\n\n💡 **Suggestions**: Try using ${suggestions.map(s => `\`${s}\``).join(', ')}`;
            }

            return finalResponse;
        }
    }

    const overflowError = "Error: Agent reached maximum iterations loop limit. Stopped for safety.";
    saveMessage('assistant', overflowError, senderId, platform);
    return overflowError;
}

import { VectorMemory } from './memory/vectorDb.js';

export async function processUserMessage(
    userText: string,
    senderId: string = 'default',
    platform: string = 'unknown',
    attachments?: any[],
    groupId?: string
): Promise<string> {
    const contextId = groupId ? `group:${groupId}` : senderId;

    if (userText.startsWith('/')) {
        const [cmd, ...args] = userText.split(' ');
        const result = await handleCommand(cmd.toLowerCase(), args, senderId, platform);
        if (result) return result;
    }

    saveMessage('user', userText, contextId, platform);

    // Log user message to Supabase
    SupabaseLogger.logEvent('message', platform, senderId, userText, { role: 'user', groupId }).catch(() => { });

    VectorMemory.saveMemory(userText, { senderId, platform, groupId }).catch(err => console.error('[Vector] Save Error:', err));

    const recentHistoryRows = getRecentHistory(contextId, platform, 10);
    const messages: MessageParam[] = recentHistoryRows.map(row => ({
        role: row.role as 'user' | 'assistant',
        content: row.content
    }));

    if (messages.length === 0 || messages[messages.length - 1].role !== 'user' || messages[messages.length - 1].content !== userText) {
        if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
            messages.pop();
        }
        messages.push({ role: 'user', content: userText });
    }

    if (messages.length > 20) {
        console.log(`[Agent] Pruning context (length: ${messages.length})...`);
        const toPrune = messages.splice(0, 15);
        const summaryPrompt = `Please summarize the following conversation snippet concisely for persistent context: \n\n${JSON.stringify(toPrune)}`;
        try {
            const summaryResponse = await providerManager.createMessage([{ role: 'user', content: summaryPrompt }], "You are a context assistant.", []);
            messages.unshift({ role: 'user', content: `[CONTEXT SUMMARY]: ${summaryResponse.text}` });
        } catch (e) {
            console.error('[Agent] Context pruning failed, proceeding without summary.');
        }
    }

    return runAgentLoop(messages, senderId, platform, attachments);
}

import { RecommendationEngine } from './agent/recommender.js';

async function handleCommand(cmd: string, args: string[], senderId: string, platform: string): Promise<string | null> {
    switch (cmd) {
        case '/airgap':
            const mode = args[0]?.toLowerCase();
            if (mode === 'on') {
                (config as any).airGappedMode = true;
                return "🛡️ Air-Gapped Mode: **ON**. All external web tools are now disabled for maximum privacy.";
            } else if (mode === 'off') {
                (config as any).airGappedMode = false;
                return "🌐 Air-Gapped Mode: **OFF**. External web tools are now enabled.";
            }
            return `Air-Gapped Mode is currently ${config.airGappedMode ? 'ON' : 'OFF'}. Use \`/airgap on\` or \`/airgap off\`.`;

        case '/model':
            const modelName = args[0];
            if (!modelName) return `Available providers: ${providerManager.getAvailableProviders().join(', ')}. Current index: ${(providerManager as any).currentProviderIndex}`;
            try {
                providerManager.setProvider(modelName);
                return `Successfully switched to ${modelName}.`;
            } catch (e: any) {
                return `Error: ${e.message}`;
            }

        case '/usage':
            const usage = db.prepare(`
                SELECT SUM(prompt_tokens) as prompt, SUM(completion_tokens) as completion, SUM(total_tokens) as total 
                FROM messages 
                WHERE sender_id = ? AND platform = ?
            `).get(senderId, platform) as any;
            if (!usage || !usage.total) return "No usage recorded for this session yet.";
            const cost = (usage.prompt * 0.000003) + (usage.completion * 0.000015);
            return `📊 **Usage Report** (${platform}):\n- Prompt: ${usage.prompt}\n- Completion: ${usage.completion}\n- Total Tokens: ${usage.total}\n- Est. Cost: $${cost.toFixed(4)}`;

        case '/status':
            return `✅ **Status**: Online\n- Platform: ${platform}\n- User: ${senderId}\n- Active Providers: ${providerManager.getAvailableProviders().join(', ')}`;

        case '/compact':
            return "Context pruning is automatic when history exceeds 20 messages.";

        case '/new':
            return "Session clearing is handled by the platform router.";

        case '/think':
            const subArg = args[0]?.toLowerCase();
            if (subArg === 'on') {
                reasoningMode = true;
                return "🧠 Reasoning Mode: **ON**. I will now use more powerful models for complex tasks.";
            } else if (subArg === 'off') {
                reasoningMode = false;
                return "⚡ Reasoning Mode: **OFF**. Switching back to faster response models.";
            }
            return `Reasoning mode is currently ${reasoningMode ? 'ON' : 'OFF'}. Use \`/think on\` or \`/think off\`.`;

        case '/skills':
            return await toolRegistry.executeTool('skill_list', {}, senderId);

        case '/mesh':
            const objective = args.join(' ');
            if (!objective) return "Please provide an objective for the mesh workflow. Example: `/mesh Research current AI trends and write a summary.`";
            return "Mesh workflow initiated. I am assembling a team of sub-agents...";

        default:
            return null;
    }
}

export async function triggerProactiveEvent(systemEventText: string, senderId: string = 'default', platform: string = 'system'): Promise<string> {
    console.log(`[Agent] Proactive Event Triggered: ${systemEventText}`);
    const recentHistoryRows = getRecentHistory(senderId, platform, 10);
    const messages: MessageParam[] = recentHistoryRows.map(row => ({
        role: row.role as 'user' | 'assistant',
        content: row.content
    }));
    messages.push({ role: 'user', content: `[SYSTEM EVENT]: ${systemEventText}` });
    return runAgentLoop(messages, senderId, platform);
}
