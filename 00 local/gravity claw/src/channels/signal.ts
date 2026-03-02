import { spawn } from 'child_process';
import { config } from '../config.js';
import { router } from './router.js';

export async function startSignal() {
    if (!config.signalNumber) {
        console.log('[Signal] Skipping initialization (no SIGNAL_NUMBER provided)');
        return;
    }

    console.log(`[Signal] Initializing bridge for ${config.signalNumber}...`);

    // We use signal-cli in JSON-RPC mode to interact with it programmatically.
    // This assumes signal-cli is installed and configured on the host.
    const signal = spawn('signal-cli', ['--account', config.signalNumber, 'jsonRpc']);

    signal.stdout.on('data', async (data) => {
        const lines = data.toString().split('\n').filter(Boolean);
        for (const line of lines) {
            try {
                const msg = JSON.parse(line);

                // We are looking for receive notifications
                if (msg.method === 'receive' && msg.params?.envelope?.dataMessage) {
                    const envelope = msg.params.envelope;
                    const dataMessage = envelope.dataMessage;

                    // Ignore our own messages (if they appear in sync)
                    if (envelope.sourceNumber === config.signalNumber) continue;

                    const text = dataMessage.message;
                    if (!text) continue;

                    const sender = envelope.sourceNumber || envelope.sourceUuid || 'unknown';
                    const group = dataMessage.groupInfo?.groupId;

                    try {
                        await router.handleIncomingMessage({
                            platform: 'Signal',
                            channelId: group || sender,
                            senderId: sender,
                            text: text,
                            reply: async (replyText) => {
                                // Send back via JSON-RPC
                                const sendCmd = {
                                    jsonrpc: '2.0',
                                    method: 'send',
                                    params: {
                                        message: replyText,
                                        recipient: [sender],
                                        ...(group ? { groupId: group } : {})
                                    },
                                    id: Date.now()
                                };
                                signal.stdin.write(JSON.stringify(sendCmd) + '\n');
                            }
                        });
                    } catch (error: any) {
                        console.error('[Signal] Error routing message:', error.message);
                    }
                }
            } catch (err) {
                // Not JSON or parse error, skip
            }
        }
    });

    signal.stderr.on('data', (data) => {
        // Log errors but don't crash
        const errorMsg = data.toString().trim();
        if (errorMsg) console.error(`[Signal CLI Error] ${errorMsg}`);
    });

    signal.on('close', (code) => {
        console.log(`[Signal] Bridge process exited with code ${code}`);
        // Optional: Re-initialize if unintended exit
        if (code !== 0) {
            setTimeout(startSignal, 5000);
        }
    });

    console.log('[Signal] Bridge process spawned successfully');
}
