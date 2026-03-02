import axios from 'axios';
import { config } from '../config.js';

export const homeAssistantTools = [
    {
        name: 'ha_list_entities',
        description: 'List all available entities and their current state from Home Assistant.',
        parameters: { type: 'object', properties: {} },
        execute: async () => {
            if (!config.haUrl || !config.haToken) return 'Error: Home Assistant not configured.';

            try {
                const response = await axios.get(`${config.haUrl}/api/states`, {
                    headers: { Authorization: `Bearer ${config.haToken}` }
                });
                const data = response.data as any[];
                const entities = data.map((e: any) => `${e.entity_id}: ${e.state} (${e.attributes.friendly_name || 'No Name'})`);
                return entities.slice(0, 50).join('\n'); // Cap at 50 for context
            } catch (error: any) {
                return `Failed to list entities: ${error.message}`;
            }
        }
    },
    {
        name: 'ha_control_device',
        description: 'Control a Home Assistant device (turn on, turn off, toggle).',
        parameters: {
            type: 'object',
            properties: {
                entity_id: { type: 'string', description: 'The entity ID (e.g. "light.living_room")' },
                action: { type: 'string', enum: ['turn_on', 'turn_off', 'toggle'], description: 'Action to perform' }
            },
            required: ['entity_id', 'action']
        },
        execute: async ({ entity_id, action }: { entity_id: string, action: string }) => {
            if (!config.haUrl || !config.haToken) return 'Error: Home Assistant not configured.';

            const domain = entity_id.split('.')[0];
            try {
                await axios.post(`${config.haUrl}/api/services/${domain}/${action}`, {
                    entity_id
                }, {
                    headers: { Authorization: `Bearer ${config.haToken}` }
                });
                return `Successfully triggered ${action} for ${entity_id}.`;
            } catch (error: any) {
                return `Failed to control device: ${error.message}`;
            }
        }
    }
];
