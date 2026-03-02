import { Bot, Context, NextFunction, InputFile } from 'grammy';
import { config } from './config.js';
import { processUserMessage } from './agent.js';
import { transcribeAudio } from './voice/transcribe.js';
import { generateSpeech } from './voice/tts.js';
import axios from 'axios';
import { talkMode } from './voice/talkMode.js';

export const bot = new Bot(config.telegramBotToken);

// Security Middleware: User ID Whitelist
bot.use(async (ctx: Context, next: NextFunction) => {
    if (ctx.from?.id !== config.telegramUserId) {
        console.warn(`[Security] Unauthorized access attempt from user ID: ${ctx.from?.id}`);
        // Silently ignore
        return;
    }
    await next();
});

// Helper to handle the actual processing and replying
async function handleMessageProcessing(ctx: Context, userText: string, isVoice: boolean) {
    await ctx.replyWithChatAction('typing');

    const sessionId = `Telegram:${ctx.chat?.id}`;

    try {
        const responseText = await processUserMessage(userText, String(ctx.from?.id || 'unknown'), 'Telegram');

        // If user spoke to us OR we are in Talk Mode, we speak back to them
        const shouldSpeak = isVoice || talkMode.isTalkModeActive(sessionId);

        if (shouldSpeak) {
            // First, send the text for immediate reading and accessibility
            await ctx.reply(responseText);

            // Then generate and send the audio response
            try {
                await ctx.replyWithChatAction('record_voice');
                const audioBuffer = await generateSpeech(responseText);
                await ctx.replyWithVoice(
                    new InputFile(audioBuffer),
                    { reply_parameters: { message_id: ctx.message?.message_id || 0 } }
                );
            } catch (ttse) {
                console.error('[Voice Error]:', ttse);
                await ctx.reply(`(Failed to generate voice response: ${(ttse as any).message})`);
            }
        } else {
            // Normal text response
            await ctx.reply(responseText);
        }
    } catch (error) {
        console.error(`[Error] Processing message:`, error);
        await ctx.reply(`Error processing message: ${(error as any).message}`);
    }
}

// Route: Commands
bot.command('talk', async (ctx) => {
    const sessionId = `Telegram:${ctx.chat?.id}`;
    const isActive = talkMode.toggleTalkMode(sessionId);
    if (isActive) {
        await ctx.reply("🎙️ Talk Mode Activated for this chat. I will respond with voice to all your messages!");
    } else {
        await ctx.reply("🔇 Talk Mode Deactivated. Reverting to text-only replies.");
    }
});

// Route: Text Messages
bot.on('message:text', async (ctx) => {
    console.log(`[Bot] Received text message.`);
    await handleMessageProcessing(ctx, ctx.message.text, false);
});

// Route: Voice Messages
bot.on('message:voice', async (ctx) => {
    console.log(`[Bot] Received voice message.`);
    await ctx.replyWithChatAction('typing'); // Indicate we are processing audio

    try {
        // 1. Download the voice file from Telegram
        const fileId = ctx.message.voice.file_id;
        const fileInfo = await ctx.api.getFile(fileId);

        if (!fileInfo.file_path) {
            throw new Error('Could not get file path from Telegram');
        }

        const fileUrl = `https://api.telegram.org/file/bot${config.telegramBotToken}/${fileInfo.file_path}`;

        console.log(`[Bot] Downloading audio file...`);
        const audioRes = await axios.get(fileUrl, { responseType: 'arraybuffer' });
        const audioBuffer = Buffer.from(audioRes.data as ArrayBuffer);

        // 2. Transcribe using Whisper
        console.log(`[Bot] Transcribing audio via Whisper...`);
        const transcribedText = await transcribeAudio(audioBuffer, 'voice.ogg');

        console.log(`[Bot] Transcribed: "${transcribedText}"`);
        await ctx.reply(`[Transcribed]: ${transcribedText}`);

        // 3. Process the transcribed text normally via Agent loop
        await handleMessageProcessing(ctx, transcribedText, true);

    } catch (err: any) {
        console.error(`[Error] Voice processing:`, err);
        await ctx.reply(`Error processing voice message: ${err.message}`);
    }
});
// Route: Photo Messages
bot.on('message:photo', async (ctx) => {
    console.log(`[Bot] Received photo message.`);
    await ctx.replyWithChatAction('typing');

    try {
        // 1. Get the highest resolution photo
        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        const fileId = photo.file_id;
        const fileInfo = await ctx.api.getFile(fileId);

        if (!fileInfo.file_path) {
            throw new Error('Could not get file path from Telegram');
        }

        const fileUrl = `https://api.telegram.org/file/bot${config.telegramBotToken}/${fileInfo.file_path}`;

        console.log(`[Bot] Downloading photo...`);
        const photoRes = await axios.get(fileUrl, { responseType: 'arraybuffer' });
        const photoBuffer = Buffer.from(photoRes.data as ArrayBuffer);
        const base64Photo = photoBuffer.toString('base64');

        // 2. Process via Agent loop with attachment
        const caption = ctx.message.caption || "Describe this image.";
        const responseText = await processUserMessage(
            caption,
            String(ctx.from?.id || 'unknown'),
            'Telegram',
            [{ type: 'image', media_type: 'image/jpeg', data: base64Photo }]
        );

        await ctx.reply(responseText);

    } catch (err: any) {
        console.error(`[Error] Photo processing:`, err);
        await ctx.reply(`Error processing photo: ${err.message}`);
    }
});
