import express from 'express';
import { triggerProactiveEvent, processUserMessage } from '../agent.js';
import path from 'path';

// Unified Webhook Server (Feature 10 & 34)
export const startWebhookServer = (port: number = 3001) => {
    const app = express();
    app.use(express.json());
    app.use(express.static('src/public'));

    // Generic Webhook Trigger (Feature 34)
    app.post('/api/webhook/:id', async (req, res) => {
        const { id } = req.params;
        const { message, event, senderId = 'webhook_user' } = req.body;
        console.log(`[Webhook] Received trigger for ID: ${id}`);
        try {
            let result = '';
            if (event) {
                result = await triggerProactiveEvent(`[Webhook ${id}] ${event}`, senderId, 'webhook');
            } else if (message) {
                result = await processUserMessage(message, senderId, 'webhook');
            } else {
                return res.status(400).json({ error: 'Missing "message" or "event" in request body.' });
            }
            res.json({ success: true, result });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // MS Teams Endpoint (Feature 7)
    app.post('/api/messages', async (req, res) => {
        console.log('[Teams] Message received');
        const { text, from } = req.body;
        if (text) {
            const reply = await processUserMessage(text, from.id, 'teams');
            res.json({ type: 'message', text: reply });
        } else {
            res.sendStatus(200);
        }
    });

    app.listen(port, () => {
        console.log(`[Channels] Unified Webhook Server listening on port ${port}`);
    });
};

// iMessage / BlueBubbles (Feature 6)
export const startBlueBubbles = async () => {
    console.log('[iMessage] Connecting to BlueBubbles...');
    // In a real scenario, this would poll or use a webhook from BlueBubbles
    // For now, we stub the listener logic
};

// MS Teams (Feature 7 - Legacy stub for direct initialization if needed)
export const startTeams = async () => {
    console.log('[Teams] Bot initialized (listening via /api/messages)');
};
