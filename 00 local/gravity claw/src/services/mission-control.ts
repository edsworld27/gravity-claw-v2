/**
 * Mission Control Bridge
 *
 * Communicates with Mission Control via the secure proxy.
 * Works in both local and split deployment modes.
 *
 * Agent → Proxy → Mission Control
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get proxy configuration from environment
const PROXY_URL = process.env.PROXY_URL || 'http://localhost:4000';
const AGENT_KEY = process.env.AGENT_KEY || '';

interface ApiPermission {
    id: string;
    name: string;
    enabled: boolean;
}

interface ActionPermission {
    category: string;
    action: string;
    allowed: boolean;
    requires_confirmation: boolean;
}

interface Permissions {
    apis: ApiPermission[];
    actions: ActionPermission[];
}

class MissionControlBridge {
    private permissions: Permissions | null = null;
    private lastFetch: number = 0;
    private cacheDuration: number = 60000; // 1 minute cache

    /**
     * Fetch permissions from proxy
     */
    async fetchPermissions(): Promise<Permissions | null> {
        // Return cached if fresh
        if (this.permissions && Date.now() - this.lastFetch < this.cacheDuration) {
            return this.permissions;
        }

        try {
            const response = await fetch(`${PROXY_URL}/permissions`, {
                headers: {
                    'X-Agent-Key': AGENT_KEY
                }
            });

            if (!response.ok) {
                console.error('[MissionControl] Failed to fetch permissions:', response.status);
                return null;
            }

            this.permissions = await response.json();
            this.lastFetch = Date.now();
            return this.permissions;

        } catch (error) {
            console.error('[MissionControl] Error fetching permissions:', error);
            return null;
        }
    }

    /**
     * Check if an API is enabled
     */
    async isApiEnabled(apiId: string): Promise<boolean> {
        const permissions = await this.fetchPermissions();
        if (!permissions) return false;

        const api = permissions.apis.find(a => a.id === apiId);
        return api?.enabled ?? false;
    }

    /**
     * Check if an action is allowed
     */
    async isActionAllowed(category: string, action: string): Promise<{ allowed: boolean; requires_confirmation: boolean }> {
        try {
            const response = await fetch(`${PROXY_URL}/permissions/check?category=${category}&action=${action}`, {
                headers: {
                    'X-Agent-Key': AGENT_KEY
                }
            });

            if (!response.ok) {
                return { allowed: false, requires_confirmation: true };
            }

            return await response.json();

        } catch (error) {
            console.error('[MissionControl] Error checking action:', error);
            return { allowed: false, requires_confirmation: true };
        }
    }

    /**
     * Get all enabled APIs
     */
    async getEnabledApis(): Promise<string[]> {
        const permissions = await this.fetchPermissions();
        if (!permissions) return [];

        return permissions.apis
            .filter(a => a.enabled)
            .map(a => a.id);
    }

    /**
     * Get all allowed actions
     */
    async getAllowedActions(): Promise<ActionPermission[]> {
        const permissions = await this.fetchPermissions();
        if (!permissions) return [];

        return permissions.actions.filter(a => a.allowed);
    }

    /**
     * Fetch user context (Brain memories, Habits, Stats)
     * This is the "Peephole" pattern implementation.
     */
    async getUserContext(): Promise<any> {
        if (!this.hasAgentKey()) return null;

        try {
            const peepholeUrl = PROXY_URL.endsWith('/') ? `${PROXY_URL}api/mc/peephole` : `${PROXY_URL}/api/mc/peephole`;
            const response = await fetch(peepholeUrl, {
                headers: {
                    'X-Agent-Key': AGENT_KEY
                }
            });

            if (!response.ok) {
                console.error('[MissionControl] Failed to fetch user context:', response.status);
                return null;
            }

            return await response.json();
        } catch (error) {
            console.error('[MissionControl] Error fetching user context:', error);
            return null;
        }
    }

    /**
     * Check proxy health
     */
    async checkProxyHealth(): Promise<boolean> {
        try {
            const response = await fetch(`${PROXY_URL}/health`);
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Log activity (local file and optionally push to proxy)
     */
    async logActivity(type: string, content: string, metadata?: Record<string, any>): Promise<void> {
        // 1. Local logging for persistence on VPS
        const logDir = path.join(__dirname, '../../data/logs');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

        const entry = {
            timestamp: new Date().toISOString(),
            type,
            content,
            metadata,
            agentId: 'gravity-claw-main' // Could be configurable
        };

        const logFile = path.join(logDir, 'activity.jsonl');
        fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');

        // 2. Push to Mission Control via Proxy
        if (this.hasAgentKey()) {
            try {
                // Use the bridge to push to the mc/activity endpoint
                const activityUrl = PROXY_URL.endsWith('/') ? `${PROXY_URL}api/mc/activity` : `${PROXY_URL}/api/mc/activity`;

                await fetch(activityUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Agent-Key': AGENT_KEY
                    },
                    body: JSON.stringify(entry)
                });
            } catch (error) {
                // Don't crash if proxy is down, just log locally
                console.warn('[MissionControl] Failed to push activity to proxy:', error);
            }
        }
    }

    /**
     * Log agent startup
     */
    async logStartup(): Promise<void> {
        await this.logActivity('status', 'Gravity Claw agent started', { status: 'online' });
        console.log('[MissionControl] Agent started');
    }

    /**
     * Log agent shutdown
     */
    async logShutdown(): Promise<void> {
        await this.logActivity('status', 'Gravity Claw agent stopped', { status: 'offline' });
        console.log('[MissionControl] Agent stopped');
    }

    /**
     * Log message processed
     */
    async logMessage(platform: string, direction: 'in' | 'out', tokens?: number): Promise<void> {
        const content = direction === 'in'
            ? `Message received via ${platform}`
            : `Response sent via ${platform}`;

        await this.logActivity(direction === 'in' ? 'message_in' : 'message_out', content, { platform, tokens });
    }

    /**
     * Log tool execution
     */
    async logToolUse(toolName: string, success: boolean): Promise<void> {
        await this.logActivity('tool', `${success ? '✓' : '✗'} Tool: ${toolName}`, { tool: toolName, success });
    }

    /**
     * Send heartbeat to Mission Control (called every minute)
     */
    heartbeat(messageCount: number, tokenCount: number): void {
        if (!this.hasAgentKey()) return;

        const heartbeatUrl = `${PROXY_URL}/api/mc/heartbeat`;
        fetch(heartbeatUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Agent-Key': AGENT_KEY
            },
            body: JSON.stringify({
                agentId: 'gravity-claw-main',
                timestamp: new Date().toISOString(),
                messageCount,
                tokenCount,
                memory: process.memoryUsage().rss,
                uptime: process.uptime()
            })
        }).catch(() => { /* Silent fail - heartbeat is non-critical */ });
    }

    /**
     * Get proxy URL
     */
    getProxyUrl(): string {
        return PROXY_URL;
    }

    /**
     * Check if agent key is configured
     */
    hasAgentKey(): boolean {
        return !!AGENT_KEY && AGENT_KEY !== 'your_agent_key_here';
    }
}

// Export singleton instance
export const missionControl = new MissionControlBridge();
