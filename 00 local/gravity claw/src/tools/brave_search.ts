import axios from 'axios';
import { config } from '../config.js';

export const braveSearchTools = [
    {
        name: 'brave_search',
        description: 'Search the web using Brave Search API for real-time information.',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'The search query' },
                count: { type: 'number', description: 'Number of results (1-20)', default: 5 }
            },
            required: ['query']
        },
        execute: async ({ query, count = 5 }: { query: string, count?: number }) => {
            if (!config.braveSearchApiKey) {
                return 'Error: Brave Search API key is not configured in .env';
            }

            try {
                const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
                    params: { q: query, count },
                    headers: {
                        'Accept': 'application/json',
                        'Accept-Encoding': 'gzip',
                        'X-Subscription-Token': config.braveSearchApiKey
                    }
                });

                const data = response.data;
                const results = data.web?.results || [];

                if (results.length === 0) {
                    return `No results found for "${query}".`;
                }

                return results.map((r: any) => `### ${r.title}\nURL: ${r.url}\nDescription: ${r.description}`).join('\n\n');
            } catch (error: any) {
                console.error('[Brave Search Error]:', error.response?.data || error.message);
                return `Failed to perform Brave search: ${error.message}`;
            }
        }
    }
];
