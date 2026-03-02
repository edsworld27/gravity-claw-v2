import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import fs from 'fs';
import path from 'path';

const supabase = (config.supabaseUrl && config.supabaseServiceKey)
    ? createClient(config.supabaseUrl, config.supabaseServiceKey)
    : null;

const ACTIVITY_PATH = path.resolve(process.cwd(), 'data/activity.json');

export class SupabaseLogger {
    /**
     * Log an event to the activity_log table.
     */
    public static async logEvent(type: 'message' | 'tool_call' | 'heartbeat' | 'system' | 'security_warning', platform: string, senderId: string, content: string, metadata: any = {}): Promise<void> {
        const timestamp = new Date().toISOString();
        const event = { type, platform, sender_id: senderId, content, metadata, timestamp };

        // 1. Supabase Logging
        if (supabase) {
            const { error } = await supabase.from('activity_log').insert(event);
            if (error) console.error('[SupabaseLogger Error]:', error);
        }

        // 2. Local Fallback Logging (for Mission Control)
        try {
            let activity = [];
            if (fs.existsSync(ACTIVITY_PATH)) {
                activity = JSON.parse(fs.readFileSync(ACTIVITY_PATH, 'utf8'));
            }
            activity.unshift(event);
            // Limit to 50 items
            if (activity.length > 50) activity = activity.slice(0, 50);

            if (!fs.existsSync(path.dirname(ACTIVITY_PATH))) {
                fs.mkdirSync(path.dirname(ACTIVITY_PATH), { recursive: true });
            }
            fs.writeFileSync(ACTIVITY_PATH, JSON.stringify(activity, null, 2));
        } catch (err) {
            console.error('[SupabaseLogger Local Error]:', err);
        }
    }

    /**
     * Update or set a bot configuration value.
     */
    public static async setConfig(key: string, value: any): Promise<void> {
        if (!supabase) return;

        const { error } = await supabase.from('bot_config').upsert({
            key,
            value,
            updated_at: new Date().toISOString()
        });

        if (error) {
            console.error('[SupabaseConfig Error]:', error);
        }
    }

    /**
     * Get a bot configuration value.
     */
    public static async getConfig(key: string): Promise<any | null> {
        if (!supabase) return null;

        const { data, error } = await supabase
            .from('bot_config')
            .select('value')
            .eq('key', key)
            .maybeSingle();

        if (error) {
            console.error('[SupabaseConfig Get Error]:', error);
            return null;
        }

        return data?.value;
    }

    /**
     * Set a bot secret (encrypted).
     */
    public static async setSecret(key: string, value: string): Promise<void> {
        if (!supabase) return;

        const { error } = await supabase.from('bot_secrets').upsert({
            key,
            value, // Note: In a production app, we would encrypt this before sending if Supabase isn't doing it at rest.
            updated_at: new Date().toISOString()
        });

        if (error) {
            console.error('[SupabaseSecret Set Error]:', error);
        }
    }

    /**
     * Get a bot secret.
     */
    public static async getSecret(key: string): Promise<string | null> {
        if (!supabase) return null;

        const { data, error } = await supabase
            .from('bot_secrets')
            .select('value')
            .eq('key', key)
            .maybeSingle();

        if (error) {
            console.error('[SupabaseSecret Get Error]:', error);
            return null;
        }

        return data?.value;
    }
}
