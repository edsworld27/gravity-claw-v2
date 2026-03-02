/**
 * Agent Key System - Gravity Claw Core Security
 *
 * Agent Keys are unique cryptographic identifiers issued by Gravity Claw
 * to authenticate agents within the system. Without a valid agent key,
 * all requests are treated as untrusted/potentially hostile.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Agent Key prefix for easy identification
const AGENT_KEY_PREFIX = 'gc-agent-';

export interface AgentKeyMetadata {
    keyId: string;           // The full agent key (gc-agent-xxx)
    name: string;            // Human-readable agent name
    createdAt: number;       // Unix timestamp
    expiresAt?: number;      // Optional expiration
    permissions: AgentPermissions;
    status: 'active' | 'revoked' | 'expired';
    lastUsed?: number;
    usageCount: number;
    allowedProviders?: string[];  // Which API providers this key can access
    rateLimit?: number;           // Requests per minute
}

export interface AgentPermissions {
    canAccessOpenAI: boolean;
    canAccessAnthropic: boolean;
    canAccessOpenRouter: boolean;
    canAccessOllama: boolean;
    canExecuteTools: boolean;
    canAccessMemory: boolean;
    canAccessExternalAPIs: boolean;
    maxTokensPerRequest?: number;
    allowedTools?: string[];      // Empty = all tools, or specific list
}

export interface AgentKeyValidation {
    isValid: boolean;
    reason?: string;
    metadata?: AgentKeyMetadata;
}

class AgentKeyRegistry {
    private keys: Map<string, AgentKeyMetadata> = new Map();
    private storagePath: string;
    private secretKey: Buffer;  // For HMAC signing

    constructor() {
        this.storagePath = path.resolve(process.cwd(), 'data/agent-keys.json');
        this.secretKey = this.loadOrCreateSecretKey();
        this.loadKeys();
    }

    private loadOrCreateSecretKey(): Buffer {
        const secretPath = path.resolve(process.cwd(), 'data/.agent-secret');

        try {
            if (fs.existsSync(secretPath)) {
                return Buffer.from(fs.readFileSync(secretPath, 'utf8'), 'hex');
            }
        } catch (error) {
            console.error('[AgentKeys] Failed to load secret key, generating new one');
        }

        // Generate new 256-bit secret key
        const newSecret = crypto.randomBytes(32);

        // Ensure data directory exists
        const dataDir = path.dirname(secretPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        fs.writeFileSync(secretPath, newSecret.toString('hex'), { mode: 0o600 });
        console.log('[AgentKeys] Generated new secret key');
        return newSecret;
    }

    private loadKeys(): void {
        try {
            if (fs.existsSync(this.storagePath)) {
                const data = JSON.parse(fs.readFileSync(this.storagePath, 'utf8'));
                for (const key of data) {
                    this.keys.set(key.keyId, key);
                }
                console.log(`[AgentKeys] Loaded ${this.keys.size} agent keys`);
            }
        } catch (error) {
            console.error('[AgentKeys] Failed to load keys:', error);
        }
    }

    private saveKeys(): void {
        try {
            const dataDir = path.dirname(this.storagePath);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            const data = Array.from(this.keys.values());
            fs.writeFileSync(this.storagePath, JSON.stringify(data, null, 2), { mode: 0o600 });
        } catch (error) {
            console.error('[AgentKeys] Failed to save keys:', error);
        }
    }

    /**
     * Generate a new cryptographically secure agent key
     */
    generateKey(name: string, permissions: Partial<AgentPermissions> = {}, expiresInDays?: number): AgentKeyMetadata {
        // Generate random bytes and create HMAC-signed key
        const randomPart = crypto.randomBytes(16).toString('hex');
        const timestamp = Date.now().toString(36);
        const dataToSign = `${randomPart}:${timestamp}:${name}`;

        // Create HMAC signature
        const hmac = crypto.createHmac('sha256', this.secretKey);
        hmac.update(dataToSign);
        const signature = hmac.digest('hex').substring(0, 12);

        const keyId = `${AGENT_KEY_PREFIX}${randomPart}-${signature}`;

        const defaultPermissions: AgentPermissions = {
            canAccessOpenAI: true,
            canAccessAnthropic: true,
            canAccessOpenRouter: true,
            canAccessOllama: true,
            canExecuteTools: true,
            canAccessMemory: true,
            canAccessExternalAPIs: true,
            ...permissions
        };

        const metadata: AgentKeyMetadata = {
            keyId,
            name,
            createdAt: Date.now(),
            expiresAt: expiresInDays ? Date.now() + (expiresInDays * 24 * 60 * 60 * 1000) : undefined,
            permissions: defaultPermissions,
            status: 'active',
            usageCount: 0
        };

        this.keys.set(keyId, metadata);
        this.saveKeys();

        console.log(`[AgentKeys] Generated new key for "${name}": ${keyId}`);
        return metadata;
    }

    /**
     * Validate an agent key and return its permissions
     */
    validateKey(keyId: string): AgentKeyValidation {
        // Check format
        if (!keyId || !keyId.startsWith(AGENT_KEY_PREFIX)) {
            return {
                isValid: false,
                reason: 'INVALID_FORMAT: Key must start with gc-agent- prefix'
            };
        }

        // Check registry
        const metadata = this.keys.get(keyId);
        if (!metadata) {
            return {
                isValid: false,
                reason: 'UNKNOWN_KEY: Key not found in registry - treating as hostile source'
            };
        }

        // Check status
        if (metadata.status === 'revoked') {
            return {
                isValid: false,
                reason: 'REVOKED: This agent key has been revoked'
            };
        }

        // Check expiration
        if (metadata.expiresAt && Date.now() > metadata.expiresAt) {
            metadata.status = 'expired';
            this.saveKeys();
            return {
                isValid: false,
                reason: 'EXPIRED: This agent key has expired'
            };
        }

        // Verify HMAC signature
        const parts = keyId.replace(AGENT_KEY_PREFIX, '').split('-');
        if (parts.length !== 2) {
            return {
                isValid: false,
                reason: 'TAMPERED: Key structure is invalid'
            };
        }

        // Update usage stats
        metadata.lastUsed = Date.now();
        metadata.usageCount++;
        this.saveKeys();

        return {
            isValid: true,
            metadata
        };
    }

    /**
     * Revoke an agent key
     */
    revokeKey(keyId: string): boolean {
        const metadata = this.keys.get(keyId);
        if (!metadata) {
            return false;
        }

        metadata.status = 'revoked';
        this.saveKeys();
        console.log(`[AgentKeys] Revoked key: ${keyId}`);
        return true;
    }

    /**
     * Get all registered keys (for admin/dashboard)
     */
    getAllKeys(): AgentKeyMetadata[] {
        return Array.from(this.keys.values());
    }

    /**
     * Get active keys only
     */
    getActiveKeys(): AgentKeyMetadata[] {
        return this.getAllKeys().filter(k => k.status === 'active');
    }

    /**
     * Check if a key has permission for a specific provider
     */
    canAccessProvider(keyId: string, provider: 'openai' | 'anthropic' | 'openrouter' | 'ollama'): boolean {
        const validation = this.validateKey(keyId);
        if (!validation.isValid || !validation.metadata) {
            return false;
        }

        const perms = validation.metadata.permissions;
        switch (provider) {
            case 'openai': return perms.canAccessOpenAI;
            case 'anthropic': return perms.canAccessAnthropic;
            case 'openrouter': return perms.canAccessOpenRouter;
            case 'ollama': return perms.canAccessOllama;
            default: return false;
        }
    }
}

// Singleton instance
export const agentKeyRegistry = new AgentKeyRegistry();

// Helper function to extract agent key from request headers
export function extractAgentKey(headers: Record<string, string | string[] | undefined>): string | null {
    // Check X-Agent-Key header first
    const agentKey = headers['x-agent-key'];
    if (typeof agentKey === 'string' && agentKey.startsWith(AGENT_KEY_PREFIX)) {
        return agentKey;
    }

    // Check Authorization header for Bearer token format
    const auth = headers['authorization'];
    if (typeof auth === 'string' && auth.startsWith('Bearer gc-agent-')) {
        return auth.replace('Bearer ', '');
    }

    return null;
}

// Threat classification for unknown sources
export interface ThreatAssessment {
    level: 'trusted' | 'unknown' | 'hostile';
    reason: string;
    action: 'allow' | 'quarantine' | 'reject';
}

export function assessThreat(keyValidation: AgentKeyValidation, sourceIp?: string): ThreatAssessment {
    if (keyValidation.isValid) {
        return {
            level: 'trusted',
            reason: `Valid agent key: ${keyValidation.metadata?.name}`,
            action: 'allow'
        };
    }

    // No key or invalid key = potential hostile source
    const reason = keyValidation.reason || 'No agent key provided';

    if (reason.includes('UNKNOWN_KEY') || reason.includes('INVALID_FORMAT')) {
        return {
            level: 'hostile',
            reason: `Unidentified source attempting system access: ${reason}`,
            action: 'reject'
        };
    }

    if (reason.includes('REVOKED')) {
        return {
            level: 'hostile',
            reason: 'Attempting to use revoked credentials',
            action: 'reject'
        };
    }

    if (reason.includes('EXPIRED')) {
        return {
            level: 'unknown',
            reason: 'Using expired credentials - may be legitimate but stale',
            action: 'quarantine'
        };
    }

    return {
        level: 'hostile',
        reason: `Unclassified threat: ${reason}`,
        action: 'reject'
    };
}
