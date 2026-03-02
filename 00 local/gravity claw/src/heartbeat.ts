import cron from 'node-cron';
import { Bot, InputFile } from 'grammy';
import { config } from './config.js';
import { triggerProactiveEvent } from './agent.js';
import { generateSpeech } from './voice/tts.js';
import { db } from './db/index.js';
import { SupabaseLogger } from './db/supabase.js';
import { missionControl } from './services/mission-control.js';

export function startHeartbeat(bot: Bot) {
    console.log('[Heartbeat] Scheduler initialized. Morning briefing set for 8:00 AM daily.');

    // For testing purposes, we could also use '* * * * *' to run every minute
    // Production default: '0 8 * * *' (Every day at 8:00 AM)
    cron.schedule('0 8 * * *', async () => {
        console.log('[Heartbeat] Waking up for Morning Briefing...');

        try {
            // 1. Trigger the AI to generate a briefing
            const prompt = `It is time for the morning briefing. Greet me, provide a short summary of the day/time, mention any explicit memories or goals I have told you to remember, and give me a quick encouraging word to start the day. Keep it completely natural and conversational.`;

            const responseText = await triggerProactiveEvent(prompt);

            // 2. Send the textual response
            await bot.api.sendMessage(config.telegramUserId, `🌅 [Morning Briefing]:\\n\\n${responseText}`);

            // 3. Generate and send the Voice message
            try {
                const audioBuffer = await generateSpeech(responseText);
                await bot.api.sendVoice(config.telegramUserId, new InputFile(audioBuffer));
            } catch (voiceError: any) {
                console.error('[Heartbeat] Failed to generate voice briefing:', voiceError.message);
            }

        } catch (error: any) {
            console.error('[Heartbeat] Error during briefing:', error.message);
            // Failsafe notification to admin
            await bot.api.sendMessage(config.telegramUserId, `[System Error]: Failed to run Morning Briefing: ${error.message}`).catch(() => { });
        }
    });

    // Level 11: Habit Check & Notification Processor
    // Runs every minute to support real-time status tracking and check for reminders
    cron.schedule('* * * * *', async () => {
        const now = new Date();
        const hour = now.getHours();

        console.log(`[Heartbeat] Minute check at ${hour}:${now.getMinutes().toString().padStart(2, '0')}`);
        SupabaseLogger.logEvent('heartbeat', 'system', 'agent', 'Pulse check ok', { hour, memory: process.memoryUsage().rss }).catch(() => { });

        // Report to Mission Control every minute (direct database write)
        try {
            const messageCount = (db.prepare('SELECT COUNT(*) as count FROM messages').get() as any)?.count || 0;
            const tokenSum = (db.prepare('SELECT SUM(total_tokens) as total FROM messages').get() as any)?.total || 0;
            missionControl.heartbeat(messageCount, tokenSum);
        } catch (e) { /* Mission Control DB may not exist yet */ }

        // 1. Habit "Nagging" logic (e.g., at 8 PM, check if daily goals are met)
        if (hour === 20) {
            const pendingHabits = db.prepare(`
                SELECT sender_id, platform, name, current_count, goal_count 
                FROM habits 
                WHERE frequency = 'daily' AND current_count < goal_count
            `).all() as any[];

            for (const habit of pendingHabits) {
                const message = `Hey! Just a reminder that you haven't finished your "${habit.name}" habit today (${habit.current_count}/${habit.goal_count}). You can do it! 🚀`;
                // Propagate senderId and platform for isolated routing
                await triggerProactiveEvent(message, habit.sender_id, habit.platform);
            }
        }

        // 2. Process intentional notification queue
        const notifications = db.prepare(`
            SELECT id, sender_id, platform, message 
            FROM notification_queue 
            WHERE status = 'pending' AND scheduled_for <= CURRENT_TIMESTAMP
        `).all() as any[];

        for (const note of notifications) {
            try {
                // For now, always route through triggerProactiveEvent to allow AI synthesis if needed,
                // or just send directly if it's a static message.
                await bot.api.sendMessage(note.sender_id, note.message);
                db.prepare('UPDATE notification_queue SET status = "sent" WHERE id = ?').run(note.id);
            } catch (err) {
                console.error(`[Heartbeat] Notification failed:`, err);
                db.prepare('UPDATE notification_queue SET status = "failed" WHERE id = ?').run(note.id);
            }
        }

        // 3. Reset daily habits at midnight
        if (hour === 0) {
            db.prepare("UPDATE habits SET current_count = 0, last_reset = CURRENT_TIMESTAMP WHERE frequency = 'daily'").run();
        }

        // Feature 38: Evening Recap at 9 PM
        if (hour === 21) {
            console.log('[Heartbeat] Triggering Evening Recap...');
            const recapPrompt = `It is 9 PM. Please provide a concise "Evening Recap" of the day. Summarize what we accomplished, any goals still pending, and wish me a restful evening. Be personal and encouraging.`;
            await triggerProactiveEvent(recapPrompt);
        }
    });
}
