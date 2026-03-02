import { App } from '@slack/bolt';
import { config } from '../config.js';
import { router } from './router.js';

export async function startSlack() {
    if (!config.slackBotToken || !config.slackAppToken || !config.slackSigningSecret) {
        console.log('[Slack] Skipping initialization (missing tokens)');
        return;
    }

    const app = new App({
        token: config.slackBotToken,
        signingSecret: config.slackSigningSecret,
        appToken: config.slackAppToken,
        socketMode: true, // Use Socket Mode so we don't need a public IP
        port: 3000
    });

    // Listen to @mentions
    app.event('app_mention', async ({ event, context, client, say }) => {
        const text = event.text.replace(/<@[A-Z0-9]+>/g, '').trim();
        if (!text) return;

        try {
            await router.handleIncomingMessage({
                platform: 'Slack',
                channelId: event.channel,
                senderId: event.user || 'unknown_slack_user',
                text: text,
                reply: async (replyText) => {
                    await say({ text: replyText, thread_ts: event.ts });
                }
            });
        } catch (error: any) {
            console.error('[Slack] Error routing message:', error);
        }
    });

    // Listen to Direct Messages
    app.message(async ({ message, say }) => {
        // Narrow type
        if (!('text' in message) || !('user' in message)) return;

        // Cast as any because @slack/bolt types are massive unions and we just 
        // need to know if it literally says bot_id or bot_message
        const msgAny = message as any;
        if (msgAny.bot_id || msgAny.subtype === 'bot_message') return;

        // If it's in a channel, we only listen to mentions (handled above). 
        // We only process ambient messages if it's a DM.
        if (message.channel_type !== 'im') return;

        try {
            await router.handleIncomingMessage({
                platform: 'Slack',
                channelId: message.channel,
                senderId: message.user as string,
                text: message.text || '',
                reply: async (replyText) => {
                    await say(replyText);
                }
            });
        } catch (error: any) {
            console.error('[Slack] Error routing message:', error);
        }
    });

    try {
        await app.start();
        console.log('[Slack] Connected correctly via Socket Mode');
    } catch (error: any) {
        console.error('[Slack] Failed to start:', error.message);
    }
}
