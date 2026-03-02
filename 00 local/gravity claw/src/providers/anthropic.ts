import Anthropic from '@anthropic-ai/sdk';
import { MessageParam } from '@anthropic-ai/sdk/resources/messages/messages.js';
import { LLMProvider, LLMResponse } from './types.js';

export class AnthropicProvider implements LLMProvider {
    name = 'anthropic';
    private client: Anthropic;
    private model: string;

    constructor(apiKey: string, model: string = 'claude-3-5-sonnet-20241022') {
        const useProxy = process.env.USE_LOCAL_PROXY === 'true';
        const proxyUrl = process.env.PROXY_URL || 'http://localhost:4000';
        this.client = new Anthropic({
            apiKey,
            baseURL: useProxy ? proxyUrl : undefined,
            defaultHeaders: useProxy ? { 'X-Agent-Key': process.env.AGENT_KEY || '' } : undefined,
        });
        this.model = model;
    }

    async createMessage(messages: MessageParam[], systemPrompt: string, tools: any[]): Promise<LLMResponse> {
        // Enable prompt caching for static system prompt (saves ~90% on cached tokens)
        const systemWithCache = [
            {
                type: 'text' as const,
                text: systemPrompt,
                cache_control: { type: 'ephemeral' as const }
            }
        ];

        const response = await this.client.messages.create({
            model: this.model,
            max_tokens: 1024,
            system: systemWithCache,
            messages: messages,
            tools: tools,
        });

        const textBlock = response.content.find(block => block.type === 'text');
        const toolCalls = response.content.filter(block => block.type === 'tool_use');

        return {
            text: textBlock?.type === 'text' ? textBlock.text : '',
            usage: {
                promptTokens: response.usage.input_tokens,
                completionTokens: response.usage.output_tokens,
                totalTokens: response.usage.input_tokens + response.usage.output_tokens,
                cacheCreationInputTokens: (response.usage as any).cache_creation_input_tokens,
                cacheReadInputTokens: (response.usage as any).cache_read_input_tokens,
            },
            stopReason: response.stop_reason || '',
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        };
    }
}
