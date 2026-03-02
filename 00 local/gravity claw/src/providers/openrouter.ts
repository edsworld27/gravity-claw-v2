import OpenAI from 'openai';
import { MessageParam } from '@anthropic-ai/sdk/resources/messages/messages.js';
import { LLMProvider, LLMResponse } from './types.js';

export class OpenRouterProvider implements LLMProvider {
    name = 'openrouter';
    private client: OpenAI;
    public model: string;

    constructor(apiKey: string, model: string = 'google/gemini-2.0-flash-exp:free') {
        const useProxy = process.env.USE_LOCAL_PROXY === 'true';
        const proxyUrl = process.env.PROXY_URL || 'http://localhost:4000';
        this.client = new OpenAI({
            apiKey,
            baseURL: useProxy ? `${proxyUrl}/openrouter/api/v1` : 'https://openrouter.ai/api/v1',
            defaultHeaders: useProxy ? { 'X-Agent-Key': process.env.AGENT_KEY || '' } : undefined,
        });
        this.model = model;
        console.log(`[OpenRouter] Using model: ${model}`);
    }

    setModel(model: string) {
        this.model = model;
        console.log(`[OpenRouter] Switched to model: ${model}`);
    }

    async createMessage(messages: MessageParam[], systemPrompt: string, tools: any[]): Promise<LLMResponse> {
        const openAiMessages: any[] = [
            { role: 'system', content: systemPrompt },
            ...messages.map(m => {
                let content: any = m.content;
                if (Array.isArray(m.content)) {
                    content = m.content.map((c: any) => {
                        if (c.type === 'tool_result') {
                            return { type: 'text', text: `Tool result [${c.tool_use_id}]: ${c.content}` };
                        }
                        if (c.type === 'image') {
                            return {
                                type: 'image_url',
                                image_url: {
                                    url: `data:${c.source.media_type};base64,${c.source.data}`
                                }
                            };
                        }
                        return c;
                    });
                }
                return { role: m.role, content: content };
            })
        ];

        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: openAiMessages,
            tools: tools.map(t => ({
                type: 'function',
                function: {
                    name: t.name,
                    description: t.description,
                    parameters: t.parameters,
                }
            })),
        });

        const choice = response.choices[0];
        const message = choice.message;

        return {
            text: message.content || '',
            usage: {
                promptTokens: response.usage?.prompt_tokens || 0,
                completionTokens: response.usage?.completion_tokens || 0,
                totalTokens: response.usage?.total_tokens || 0,
            },
            stopReason: choice.finish_reason === 'tool_calls' ? 'tool_use' : choice.finish_reason,
            toolCalls: (message.tool_calls as any[])?.map(tc => ({
                type: 'tool_use',
                id: tc.id,
                name: tc.function.name,
                input: JSON.parse(tc.function.arguments),
            })),
        };
    }
}
