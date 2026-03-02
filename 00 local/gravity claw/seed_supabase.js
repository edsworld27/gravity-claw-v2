import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { config } from './src/config.js';

const supabaseUrl = config.supabaseUrl;
const supabaseKey = config.supabaseServiceKey;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
    const connectionsPath = path.resolve(__dirname, 'data/connections.json');
    let connections = [];
    if (fs.existsSync(connectionsPath)) {
        connections = JSON.parse(fs.readFileSync(connectionsPath, 'utf8'));
    }

    const templates = [
        {
            id: 'openai',
            name: 'OpenAI',
            status: 'Inactive',
            type: 'LLM Provider',
            provider: 'OpenAI',
            requiredSecrets: ['API_KEY']
        },
        {
            id: 'anthropic',
            name: 'Anthropic',
            status: 'Inactive',
            type: 'LLM Provider',
            provider: 'Anthropic',
            requiredSecrets: ['API_KEY']
        },
        {
            id: 'spotify',
            name: 'Spotify',
            status: 'Inactive',
            type: 'Music',
            tools: ['spotify_search_play'],
            requiredSecrets: ['CLIENT_ID', 'CLIENT_SECRET']
        },
        {
            id: 'brave',
            name: 'Brave Search',
            status: 'Active',
            type: 'Search',
            tools: ['brave_search'],
            requiredSecrets: ['API_KEY']
        }
    ];

    templates.forEach(tpl => {
        const existing = connections.find(c => c.id === tpl.id);
        if (existing) {
            Object.assign(existing, tpl);
        } else {
            connections.push(tpl);
        }
    });

    console.log("Seeding connections to Supabase...");
    const { error } = await supabase.from('bot_config').upsert({
        key: 'connections',
        value: connections,
        updated_at: new Date().toISOString()
    });

    if (error) {
        console.error("Error seeding Supabase:", error);
    } else {
        console.log("Successfully seeded connections to Supabase.");
    }
}

seed();
