import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import * as fs from 'fs';
import * as path from 'path';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import { router } from './router.js';

export async function startWhatsApp() {
    const authFolder = path.join(process.cwd(), 'data', 'wa_auth');
    if (!fs.existsSync(authFolder)) {
        fs.mkdirSync(authFolder, { recursive: true });
    }

    console.log('[WhatsApp] Initializing...');

    const { state, saveCreds } = await useMultiFileAuthState(authFolder);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`[WhatsApp] using WA v${version.join('.')}, isLatest: ${isLatest}`);

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }) as any, // Mute overly noisy default logs
        printQRInTerminal: true,
        auth: state,
        // receive pending messages while offline
        syncFullHistory: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('[WhatsApp] QR code waiting to be scanned:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('[WhatsApp] connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);

            // reconnect if not logged out
            if (shouldReconnect) {
                startWhatsApp();
            } else {
                console.log('[WhatsApp] You are logged out. Please delete data/wa_auth and restart to scan a new QR code.');
            }
        } else if (connection === 'open') {
            console.log('[WhatsApp] Connected correctly to WhatsApp server');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        // Only process new messages
        if (m.type !== 'notify') return;

        for (const msg of m.messages) {
            // Ignore messages from ourselves or without text
            if (!msg.message || msg.key.fromMe) continue;

            // Extract text from standard, extended, or quoted messages
            const text = msg.message.conversation ||
                msg.message.extendedTextMessage?.text ||
                msg.message.ephemeralMessage?.message?.extendedTextMessage?.text ||
                '';

            if (!text.trim()) continue;

            console.log(`[WhatsApp] Received message: ${text}`);

            try {
                await router.handleIncomingMessage({
                    platform: 'WhatsApp',
                    channelId: msg.key.remoteJid || 'unknown',
                    senderId: msg.key.remoteJid || 'unknown',
                    text: text,
                    reply: async (replyText) => {
                        await sock.sendMessage(msg.key.remoteJid!, { text: replyText }, { quoted: msg });
                    }
                });
            } catch (error: any) {
                console.error('[WhatsApp] Error processing message:', error.message);
            }
        }
    });
}
