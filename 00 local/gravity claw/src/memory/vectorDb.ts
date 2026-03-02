import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import { db } from '../db/index.js';

const openai = new OpenAI({
    apiKey: config.openaiApiKey,
});

const supabase = (config.supabaseUrl && config.supabaseServiceKey)
    ? createClient(config.supabaseUrl, config.supabaseServiceKey)
    : null;

export class VectorMemory {
    /**
     * Convert text to a vector embedding using OpenAI.
     */
    public static async getEmbedding(text: string): Promise<number[]> {
        const response = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: text,
            encoding_format: "float",
        });
        return response.data[0].embedding;
    }

    /**
     * Save a content block with its embedding to the DB.
     */
    public static async saveMemory(content: string, metadata: any = {}): Promise<void> {
        const embedding = await this.getEmbedding(content);

        if (supabase) {
            console.log('[Vector] Saving to Supabase...');
            const { error } = await supabase.from('memories').insert({
                content,
                embedding,
                metadata
            });
            if (error) console.error('[Supabase Save Error]:', error);
        }

        // Always save to local SQLite for offline/low-latency fallback
        const stmt = db.prepare(`
            INSERT INTO vector_memories (content, embedding, metadata) 
            VALUES (?, ?, ?)
        `);
        const buffer = Buffer.from(new Float32Array(embedding).buffer);
        stmt.run(content, buffer, JSON.stringify(metadata));
    }

    /**
     * Search for similar memories.
     */
    public static async search(query: string, limit: number = 5): Promise<string[]> {
        const queryEmbedding = await this.getEmbedding(query);

        if (supabase) {
            console.log('[Vector] Searching Supabase...');
            const { data, error } = await supabase.rpc('match_memories', {
                query_embedding: queryEmbedding,
                match_threshold: 0.5,
                match_count: limit,
            });

            if (!error && data && data.length > 0) {
                return data.map((d: any) => d.content);
            }
            if (error) console.error('[Supabase Search Error]:', error);
        }

        // Fallback to local SQLite search
        console.log('[Vector] Falling back to SQLite search...');
        const memories = db.prepare('SELECT id, content, embedding FROM vector_memories').all() as any[];

        const results = memories.map(m => {
            const mEmbedding = new Float32Array(m.embedding.buffer, m.embedding.byteOffset, m.embedding.byteLength / 4);
            const score = this.cosineSimilarity(queryEmbedding, Array.from(mEmbedding));
            return { content: m.content, score };
        });

        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(r => r.content);
    }

    private static cosineSimilarity(a: number[], b: number[]): number {
        let dotProduct = 0;
        let mA = 0;
        let mB = 0;
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            mA += a[i] * a[i];
            mB += b[i] * b[i];
        }
        return dotProduct / (Math.sqrt(mA) * Math.sqrt(mB));
    }
}
