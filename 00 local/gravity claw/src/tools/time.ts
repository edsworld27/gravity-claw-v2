import { Tool } from '@anthropic-ai/sdk/resources/messages/messages.js';

export const getCurrentTimeToolDefinition: Tool = {
    name: 'get_current_time',
    description: 'Get the current local time of the agent.',
    input_schema: {
        type: 'object',
        properties: {},
        required: []
    }
};

export function getCurrentTimeExecutor(): string {
    return new Date().toISOString();
}

export const timeTools = [
    {
        name: getCurrentTimeToolDefinition.name,
        definition: getCurrentTimeToolDefinition,
        execute: getCurrentTimeExecutor
    }
];
