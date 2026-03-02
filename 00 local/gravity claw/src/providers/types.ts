import { MessageParam } from '@anthropic-ai/sdk/resources/messages/messages.js';

export interface LLMResponse {
    text: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        cacheCreationInputTokens?: number;
        cacheReadInputTokens?: number;
    };
    stopReason: string;
    toolCalls?: any[];
}

export interface LLMProvider {
    name: string;
    createMessage(messages: MessageParam[], systemPrompt: string, tools: any[]): Promise<LLMResponse>;
}
