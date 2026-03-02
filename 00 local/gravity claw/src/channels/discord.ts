import { Client, Events, GatewayIntentBits } from 'discord.js';
import { config } from '../config.js';
import { router } from './router.js';

export async function startDiscord() {
    // Graceful exit if no token
    if (!config.discordBotToken) {
        console.log('[Discord] Skipping initialization (no token provided)');
        return;
    }

    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.DirectMessages
        ],
        partials: [1] // 1 = CHANNEL partial for DMs
    });

    client.once(Events.ClientReady, readyClient => {
        console.log(`[Discord] Connected correctly as ${readyClient.user.tag}`);
    });

    client.on(Events.MessageCreate, async (message) => {
        // Ignore bot messages (including our own)
        if (message.author.bot) return;

        // In guilds, only respond if mentioned directly
        if (message.guild && !message.mentions.has(client.user!)) return;

        // Clean up the mention from the text so Claude doesn't see "<@1234> hello"
        const cleanText = message.content.replace(`<@${client.user?.id}>`, '').trim();
        if (!cleanText) return;

        console.log(`[Discord] Received message in ${message.guild ? 'Guild' : 'DM'}`);
        await message.channel.sendTyping();

        try {
            await router.handleIncomingMessage({
                platform: 'Discord',
                channelId: message.channelId,
                senderId: message.author.id,
                text: cleanText,
                reply: async (replyText) => {
                    await message.reply(replyText);
                }
            });
        } catch (error: any) {
            console.error('[Discord] Error routing message:', error.message);
        }
    });

    try {
        await client.login(config.discordBotToken);
    } catch (error: any) {
        console.error('[Discord] Failed to login:', error.message);
    }
}
