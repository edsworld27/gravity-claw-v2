import axios from 'axios';
import { config } from '../config.js';
import { SupabaseLogger } from '../db/supabase.js';
import fs from 'fs';
import path from 'path';

export async function generateSpeech(text: string): Promise<Buffer> {
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
            const conn = connections.find((c: any) => c.status === 'Inactive' && c.id === 'elevenlabs');
            if (conn) {
                throw new Error("Access Denied: ElevenLabs connection is currently inactive in Mission Control. If you need this, please enable it in the dashboard.");
            }
        }
    } catch (error: any) {
        if (error.message.includes('Access Denied')) throw error;
        console.error('[TTS] Failed to check connection status:', error);
    }

    if (!config.elevenLabsApiKey) {
        throw new Error("ElevenLabs API key is not configured");
    }

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${config.elevenLabsVoiceId}`;

    const payload = {
        text: text,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
        }
    };

    const headers = {
        'Accept': 'audio/mpeg',
        'xi-api-key': config.elevenLabsApiKey,
        'Content-Type': 'application/json'
    };

    try {
        const response = await axios.post(url, payload, {
            headers,
            responseType: 'arraybuffer' // crucial for returning audio buffer
        });

        return Buffer.from(response.data as ArrayBuffer);
    } catch (error: any) {
        console.error("ElevenLabs API Error:", error.response?.data?.toString() || error.message);
        throw new Error('Failed to generate speech via ElevenLabs');
    }
}
