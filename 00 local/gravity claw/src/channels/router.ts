import { processUserMessage } from '../agent.js';
import { talkMode } from '../voice/talkMode.js';
import { generateSpeech } from '../voice/tts.js';
import { config } from '../config.js';

type ReplyFunction = (text: string) => Promise<void>;

interface InboundMessage {
    platform: string;
    channelId: string;
    senderId: string;
    text: string;
    reply: ReplyFunction;
}

export class MessageRouter {
    private static instance: MessageRouter;

    private constructor() { }

    public static getInstance(): MessageRouter {
        if (!MessageRouter.instance) {
            MessageRouter.instance = new MessageRouter();
        }
        return MessageRouter.instance;
    }

    /**
     * Accepts a message from any platform, runs it through Gravity Claw's core logic,
     * and replies back via the provided callback.
     */
    public async handleIncomingMessage(msg: InboundMessage) {
        console.log(`[Router] Incoming from ${msg.platform} (${msg.senderId}): ${msg.text}`);

        const sessionId = `${msg.platform}:${msg.channelId}`;

        // Handle universal commands
        if (msg.text.trim().toLowerCase() === '/talk') {
            const isActive = talkMode.toggleTalkMode(sessionId);
            const statusMsg = isActive
                ? "🎙️ Talk Mode Activated. I will now respond with voice whenever possible."
                : "🔇 Talk Mode Deactivated. Reverting to text-only responses.";
            await msg.reply(statusMsg);
            return;
        }

        try {
            const replyText = await processUserMessage(msg.text, msg.senderId, msg.platform);

            // Send the text reply
            await msg.reply(replyText);

            // If Talk Mode is active, try to send audio as well
            if (talkMode.isTalkModeActive(sessionId)) {
                try {
                    // We check if the reply callback can handle audio objects or if we need a separate path.
                    // For now, let's assume if the platform is Webhooks (WebChat/Teams), 
                    // the specific channel implementation handles the 'audio' event if we pass it or if they check talkMode.
                    // Actually, the simplest is to have the channel implementation call talkMode.isTalkModeActive()
                } catch (e) {
                    console.error('[Router] TalkMode TTS Error:', e);
                }
            }
        } catch (error: any) {
            console.error(`[Router] Error processing ${msg.platform} message:`, error.message);
            await msg.reply(`Sorry, I encountered an error: ${error.message}`);
        }
    }
}

export const router = MessageRouter.getInstance();
