import { KnowledgeGraph } from '../memory/knowledgeGraph.js';
import { VectorMemory } from '../memory/vectorDb.js';

export const memoryPlusTools = [
    {
        name: 'kg_save',
        description: 'Save a structured relationship fact to the Knowledge Graph (e.g. subject: "Mark", predicate: "is brother of", object: "User"). Use this for important entities and their permanent relationships.',
        parameters: {
            type: 'object',
            properties: {
                subject: { type: 'string' },
                predicate: { type: 'string' },
                object: { type: 'string' }
            },
            required: ['subject', 'predicate', 'object']
        },
        execute: async ({ subject, predicate, object }: any) => {
            KnowledgeGraph.saveTriplet(subject, predicate, object);
            return `Successfully saved to Knowledge Graph: ${subject} -> ${predicate} -> ${object}`;
        }
    },
    {
        name: 'kg_query',
        description: 'Query the Knowledge Graph for relationships involving a specific entity or keyword.',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'The entity or relationship to search for' }
            },
            required: ['query']
        },
        execute: async ({ query }: any) => {
            const results = KnowledgeGraph.query(query);
            if (results.length === 0) return `No facts found in Knowledge Graph for "${query}".`;
            return results.map(r => `${r.subject} ${r.predicate} ${r.object}`).join('\n');
        }
    },
    {
        name: 'semantic_search',
        description: 'Search through past conversations and long-term memories using semantic similarity (RAG). Use this when a simple keyword search with "search_history" fails or when looking for concepts rather than exact words.',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'The concept or question to search for' },
                limit: { type: 'number', description: 'Max results (default 5)' }
            },
            required: ['query']
        },
        execute: async ({ query, limit }: any) => {
            const results = await VectorMemory.search(query, limit);
            if (results.length === 0) return 'No semantically similar memories found.';
            return results.join('\n---\n');
        }
    },
    {
        name: 'vector_save',
        description: 'Deliberately save a block of text to long-term vector memory for future semantic retrieval.',
        parameters: {
            type: 'object',
            properties: {
                content: { type: 'string', description: 'The text block to remember.' }
            },
            required: ['content']
        },
        execute: async ({ content }: any) => {
            await VectorMemory.saveMemory(content);
            return 'Successfully saved to vector memory.';
        }
    }
];
