import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import { VectorMemory } from '../memory/vectorDb.js';

export const researchTools = [
    {
        name: 'scrape_page',
        description: 'Robustly extract readable text from any URL using a headless browser. Use this for modern websites that require JavaScript.',
        parameters: {
            type: 'object',
            properties: {
                url: { type: 'string', description: 'The URL to scrape' }
            },
            required: ['url']
        },
        execute: async ({ url }: { url: string }) => {
            let browser;
            try {
                browser = await puppeteer.launch({ headless: true });
                const page = await browser.newPage();
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

                const content = await page.content();
                const $ = cheerio.load(content);

                // Remove script tags, styles, etc.
                $('script, style, nav, footer, header, aside').remove();

                const text = $('body').text().replace(/\s+/g, ' ').trim();
                return text.slice(0, 10000); // Respect context limits
            } catch (error: any) {
                return `Error scraping ${url}: ${error.message}`;
            } finally {
                if (browser) await browser.close();
            }
        }
    },
    {
        name: 'deep_research',
        description: 'Synthesize a complex answer by searching the web and scraping multiple sources. Use this when the user asks a deep, research-oriented question.',
        parameters: {
            type: 'object',
            properties: {
                topic: { type: 'string', description: 'The research topic' }
            },
            required: ['topic']
        },
        execute: async ({ topic }: { topic: string }) => {
            // Note: In a real implementation, this might be a recursive agent loop.
            // For now, we provide instructions to the LLM to use search_google + scrape_page repeatedly.
            return `Research protocol initiated for: ${topic}. Please use 'google_search' to find sources, then 'scrape_page' on the top 3 results, then synthesize your final answer.`;
        }
    }
];
