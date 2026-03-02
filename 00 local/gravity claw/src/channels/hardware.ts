import { WebSocketServer, WebSocket } from 'ws';
import { triggerProactiveEvent } from '../agent.js';

export class HardwareBridge {
    private wss: WebSocketServer | null = null;
    private clients: Set<WebSocket> = new Set();

    constructor(port: number = 3002) {
        this.wss = new WebSocketServer({ port });

        this.wss.on('connection', (ws) => {
            console.log('[Hardware] ESP32/IoT device connected.');
            this.clients.add(ws);

            ws.on('message', async (data) => {
                try {
                    const payload = JSON.parse(data.toString());
                    console.log('[Hardware] Received telemetry:', payload);

                    if (payload.event || payload.alert) {
                        const description = payload.event || payload.alert;
                        await triggerProactiveEvent(`[IoT Device] ${description}`, 'hardware_admin', 'iot');
                    }
                } catch (e) {
                    console.error('[Hardware] Failed to parse message:', data.toString());
                }
            });

            ws.on('close', () => {
                console.log('[Hardware] Device disconnected.');
                this.clients.delete(ws);
            });
        });

        console.log(`[Hardware] Bridge listening on ws://localhost:${port}`);
    }

    /**
     * Send a command to all connected hardware devices.
     */
    public broadcastCommand(command: object) {
        const payload = JSON.stringify(command);
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(payload);
            }
        });
    }
}

export const hardwareBridge = new HardwareBridge();
