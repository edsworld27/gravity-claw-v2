import axios from 'axios';
import { config } from '../config.js';

export const newsTools = [
    {
        name: 'news_get_top',
        description: 'Get top news headlines for a specific category or country.',
        parameters: {
            type: 'object',
            properties: {
                country: { type: 'string', description: 'Two-letter country code (e.g. "us", "gb")' },
                category: { type: 'string', description: 'Category (business, entertainment, general, health, science, sports, technology)' }
            }
        },
        execute: async ({ country = 'us', category = 'general' }: any) => {
            if (!config.newsApiKey) return 'Error: NewsAPI key is not configured.';

            try {
                const url = `https://newsapi.org/v2/top-headlines?country=${country}&category=${category}&apiKey=${config.newsApiKey}`;
                const response = await axios.get(url);
                const data = response.data as any;
                const articles = data.articles.slice(0, 5);

                if (articles.length === 0) return 'No news found.';

                return articles.map((a: any) => `- ${a.title} (${a.source.name})`).join('\n');
            } catch (error: any) {
                return `Failed to fetch news: ${error.message}`;
            }
        }
    },
    {
        name: 'news_search',
        description: 'Search for news articles on a specific topic.',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search keywords (e.g. "AI", "Tesla")' }
            },
            required: ['query']
        },
        execute: async ({ query }: { query: string }) => {
            if (!config.newsApiKey) return 'Error: NewsAPI key is not configured.';

            try {
                const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&apiKey=${config.newsApiKey}&sortBy=publishedAt&pageSize=5`;
                const response = await axios.get(url);
                const data = response.data as any;
                const articles = data.articles;

                if (articles.length === 0) return `No news found for "${query}".`;

                return articles.map((a: any) => `- ${a.title} (${a.source.name})`).join('\n');
            } catch (error: any) {
                return `Failed to search news: ${error.message}`;
            }
        }
    }
];
