import { LLMProvider, LLMResponse } from './types.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';
import { OpenRouterProvider } from './openrouter.js';
import { OllamaProvider } from './ollama.js';
import { config } from '../config.js';
import { MessageParam } from '@anthropic-ai/sdk/resources/messages/messages.js';
import { SupabaseLogger } from '../db/supabase.js';
import fs from 'fs';
import path from 'path';

export class ProviderManager {
    private providers: LLMProvider[] = [];
    private currentProviderIndex: number = 0;

    constructor() {
        // Priority order: Anthropic -> OpenAI
        if (config.anthropicApiKey) {
            this.providers.push(new AnthropicProvider(config.anthropicApiKey));
        }
        if (config.openaiApiKey) {
            this.providers.push(new OpenAIProvider(config.openaiApiKey));
        }
        if (config.openRouterApiKey) {
            this.providers.push(new OpenRouterProvider(config.openRouterApiKey, config.defaultModel));
        }
        if (config.ollamaUrl) {
            this.providers.push(new OllamaProvider(config.ollamaUrl));
        }
    }

    async createMessage(messages: MessageParam[], systemPrompt: string, tools: any[]): Promise<LLMResponse> {
        let lastError: Error | null = null;

        // Start from current provider, wrap around if needed for failover
        for (let i = 0; i < this.providers.length; i++) {
            const provider = this.providers[(this.currentProviderIndex + i) % this.providers.length];

            // Feature: Mission Control Toggles (Supabase & Fallback)
            try {
                let connections = await SupabaseLogger.getConfig('connections');
                if (!connections) {
                    const connectionsPath = path.resolve(process.cwd(), 'data/connections.json');
                    if (fs.existsSync(connectionsPath)) {
                        connections = JSON.parse(fs.readFileSync(connectionsPath, 'utf8'));
                    }
                }

                if (connections) {
                    const conn = connections.find((c: any) => c.status === 'Inactive' && c.provider === provider.name);
                    if (conn) {
                        console.log(`[Provider] Skipping ${provider.name} (Inactive in Mission Control)`);
                        continue;
                    }
                }
            } catch (error) {
                console.error('[Provider] Failed to check connection status:', error);
            }

            try {
                console.log(`[Provider] Using ${provider.name}...`);
                return await provider.createMessage(messages, systemPrompt, tools);
            } catch (error: any) {
                console.error(`[Provider] ${provider.name} failed: ${error.message}`);
                lastError = error;
                // Move to next provider for next call too if this one is persistent-failing
                this.currentProviderIndex = (this.currentProviderIndex + 1) % this.providers.length;
            }
        }

        throw new Error(`All LLM providers failed. Last error: ${lastError?.message}`);
    }

    setProvider(name: string) {
        const index = this.providers.findIndex(p => p.name === name);
        if (index !== -1) {
            this.currentProviderIndex = index;
            console.log(`[Provider] Manually switched to ${name}`);
        } else {
            throw new Error(`Provider ${name} not available.`);
        }
    }

    getAvailableProviders(): string[] {
        return this.providers.map(p => p.name);
    }

    /**
     * Switch to premium model for complex tasks
     */
    usePremiumModel(): void {
        const openRouter = this.providers.find(p => p.name === 'openrouter') as OpenRouterProvider;
        if (openRouter) {
            openRouter.setModel(config.premiumModel);
        }
    }

    /**
     * Switch back to free model
     */
    useFreeModel(): void {
        const openRouter = this.providers.find(p => p.name === 'openrouter') as OpenRouterProvider;
        if (openRouter) {
            openRouter.setModel(config.defaultModel);
        }
    }

    /**
     * Check if task needs premium model based on keywords
     */
    needsPremiumModel(task: string): boolean {
        const premiumKeywords = [
            'architecture', 'security', 'audit', 'review code',
            'complex', 'analyze', 'debug', 'refactor',
            'production', 'critical', 'important decision'
        ];
        const lowerTask = task.toLowerCase();
        return premiumKeywords.some(kw => lowerTask.includes(kw));
    }
}

export const providerManager = new ProviderManager();
