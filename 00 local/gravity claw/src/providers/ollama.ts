import axios from 'axios';
import { MessageParam } from '@anthropic-ai/sdk/resources/messages/messages.js';
import { LLMProvider, LLMResponse } from './types.js';

export class OllamaProvider implements LLMProvider {
    name = 'ollama';
    private baseUrl: string;
    private model: string;

    constructor(baseUrl: string = 'http://localhost:11434', model: string = 'llama3') {
        this.baseUrl = baseUrl;
        this.model = model;
    }

    async createMessage(messages: MessageParam[], systemPrompt: string, tools: any[]): Promise<LLMResponse> {
        // Ollama /api/chat format
        const ollamaMessages = [
            { role: 'system', content: systemPrompt },
            ...messages.map(m => {
                let content = m.content;
                let images: string[] = [];
                if (Array.isArray(m.content)) {
                    const textParts = m.content.filter(c => c.type === 'text').map(c => c.text);
                    const imageParts = m.content.filter(c => c.type === 'image').map(c => c.source.data);
                    content = textParts.join('\n');
                    images = imageParts;
                }
                return { role: m.role, content, images: images.length > 0 ? images : undefined };
            })
        ];

        // Tools support in Ollama is model-dependent, for now we do a simple chat
        const response = await axios.post(`${this.baseUrl}/api/chat`, {
            model: this.model,
            messages: ollamaMessages,
            stream: false,
            tools: tools.length > 0 ? tools.map(t => ({
                type: 'function',
                function: {
                    name: t.name,
                    description: t.description,
                    parameters: t.parameters,
                }
            })) : undefined
        }) as any;

        const data = response.data;
        const msg = data.message;

        return {
            text: msg.content || '',
            usage: {
                promptTokens: data.prompt_eval_count || 0,
                completionTokens: data.eval_count || 0,
                totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
            },
            stopReason: msg.tool_calls ? 'tool_use' : 'end_turn',
            toolCalls: msg.tool_calls?.map((tc: any) => ({
                type: 'tool_use',
                id: Math.random().toString(36).substring(7), // Ollama doesn't always provide IDs
                name: tc.function.name,
                input: tc.function.arguments,
            })),
        };
    }
}
