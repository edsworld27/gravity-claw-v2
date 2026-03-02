/**
 * Zero-Trust Security Middleware - Gravity Claw
 *
 * This module implements zero-trust security policies:
 * - All incoming requests are untrusted by default
 * - Agent key validation is required for internal agent-to-agent communication
 * - External channel requests (Telegram, Discord, etc.) are treated as user input
 * - All interactions are logged for audit
 */

import { Request, Response, NextFunction } from 'express';
import {
    agentKeyRegistry,
    extractAgentKey,
    assessThreat,
    type AgentKeyValidation,
    type ThreatAssessment
} from './agentKeys.js';
import { detectInjectionAttempts, sanitizeForLogging } from './promptStructure.js';
import fs from 'fs';
import path from 'path';

// Audit log path
const SECURITY_LOG_PATH = path.resolve(process.cwd(), 'data/security-audit.log');

export interface SecurityContext {
    isAuthenticated: boolean;
    agentKey?: string;
    agentName?: string;
    threatLevel: 'trusted' | 'unknown' | 'hostile';
    sourceType: 'agent' | 'user' | 'external' | 'unknown';
    sourceId?: string;
    platform?: string;
    injectionAttempts?: string[];
    timestamp: number;
}

export interface ZeroTrustConfig {
    requireAgentKey: boolean;           // Require valid agent key for all requests
    allowExternalChannels: boolean;     // Allow requests from known external channels
    logAllRequests: boolean;            // Log all requests to audit file
    rejectOnInjection: boolean;         // Reject requests with detected injection attempts
    allowedPlatforms: string[];         // List of allowed external platforms
}

const DEFAULT_CONFIG: ZeroTrustConfig = {
    requireAgentKey: false,              // External channels don't have agent keys
    allowExternalChannels: true,
    logAllRequests: true,
    rejectOnInjection: false,            // Log but don't reject (user might be testing)
    allowedPlatforms: ['telegram', 'discord', 'slack', 'whatsapp', 'signal', 'teams', 'imessage', 'webhook']
};

/**
 * Log security events to file
 */
function logSecurityEvent(event: {
    type: 'request' | 'rejection' | 'injection_attempt' | 'authentication' | 'threat';
    context: SecurityContext;
    details?: Record<string, any>;
}): void {
    const logEntry = {
        timestamp: new Date().toISOString(),
        ...event
    };

    const logLine = JSON.stringify(logEntry) + '\n';

    // Async file write
    fs.appendFile(SECURITY_LOG_PATH, logLine, (err) => {
        if (err) console.error('[Security] Failed to write audit log:', err);
    });

    // Console logging for important events
    if (event.type === 'rejection' || event.type === 'threat') {
        console.warn(`[Security] ${event.type.toUpperCase()}: ${JSON.stringify(event.context)}`);
    }
}

/**
 * Build security context for a request
 */
export function buildSecurityContext(options: {
    headers?: Record<string, string | string[] | undefined>;
    sourceType: 'agent' | 'user' | 'external';
    sourceId?: string;
    platform?: string;
    content?: string;
}): SecurityContext {
    const { headers, sourceType, sourceId, platform, content } = options;

    // Check for agent key in headers
    const agentKey = headers ? extractAgentKey(headers) : null;
    let validation: AgentKeyValidation = { isValid: false, reason: 'No key provided' };
    let threat: ThreatAssessment = { level: 'unknown', reason: 'No authentication', action: 'allow' };

    if (agentKey) {
        validation = agentKeyRegistry.validateKey(agentKey);
        threat = assessThreat(validation);
    }

    // Check for injection attempts in content
    let injectionAttempts: string[] | undefined;
    if (content) {
        const injection = detectInjectionAttempts(content);
        if (injection.detected) {
            injectionAttempts = injection.indicators;
        }
    }

    // Determine threat level based on source type
    let threatLevel: 'trusted' | 'unknown' | 'hostile' = threat.level;

    // External user channels are treated as "unknown" (not hostile, but untrusted)
    if (sourceType === 'user' || sourceType === 'external') {
        threatLevel = 'unknown';
    }

    // Valid agent key = trusted
    if (validation.isValid) {
        threatLevel = 'trusted';
    }

    return {
        isAuthenticated: validation.isValid,
        agentKey: agentKey || undefined,
        agentName: validation.metadata?.name,
        threatLevel,
        sourceType,
        sourceId,
        platform,
        injectionAttempts,
        timestamp: Date.now()
    };
}

/**
 * Express middleware for zero-trust request validation
 */
export function zeroTrustMiddleware(config: Partial<ZeroTrustConfig> = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };

    return (req: Request, res: Response, next: NextFunction) => {
        // Determine source type based on path/headers
        let sourceType: 'agent' | 'user' | 'external' = 'external';
        const platform = req.headers['x-platform'] as string || 'unknown';

        // Agent-to-agent requests should have X-Agent-Key header
        if (req.headers['x-agent-key']) {
            sourceType = 'agent';
        }

        // Build security context
        const context = buildSecurityContext({
            headers: req.headers as Record<string, string | string[] | undefined>,
            sourceType,
            sourceId: req.ip || 'unknown',
            platform,
            content: typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
        });

        // Attach context to request for downstream use
        (req as any).securityContext = context;

        // Log the request
        if (cfg.logAllRequests) {
            logSecurityEvent({
                type: 'request',
                context,
                details: {
                    method: req.method,
                    path: req.path,
                    userAgent: req.headers['user-agent']
                }
            });
        }

        // Check if agent key is required
        if (cfg.requireAgentKey && sourceType === 'agent' && !context.isAuthenticated) {
            logSecurityEvent({
                type: 'rejection',
                context,
                details: { reason: 'Missing or invalid agent key' }
            });

            return res.status(403).json({
                error: 'AUTHENTICATION_REQUIRED',
                message: 'Valid agent key required for this endpoint'
            });
        }

        // Check for injection attempts
        if (context.injectionAttempts && context.injectionAttempts.length > 0) {
            logSecurityEvent({
                type: 'injection_attempt',
                context,
                details: { indicators: context.injectionAttempts }
            });

            if (cfg.rejectOnInjection) {
                return res.status(400).json({
                    error: 'SECURITY_VIOLATION',
                    message: 'Request contains suspicious patterns'
                });
            }
            // Otherwise, continue but with warning logged
        }

        // Check if platform is allowed
        if (sourceType === 'external' && !cfg.allowedPlatforms.includes(platform.toLowerCase())) {
            logSecurityEvent({
                type: 'rejection',
                context,
                details: { reason: `Platform "${platform}" not in allowed list` }
            });

            return res.status(403).json({
                error: 'PLATFORM_NOT_ALLOWED',
                message: `Platform "${platform}" is not configured`
            });
        }

        // Check for hostile threat level
        if (context.threatLevel === 'hostile') {
            logSecurityEvent({
                type: 'threat',
                context,
                details: { action: 'rejected' }
            });

            return res.status(403).json({
                error: 'THREAT_DETECTED',
                message: 'Request rejected due to security concerns'
            });
        }

        next();
    };
}

/**
 * Validate and sanitize user input before processing
 */
export function validateUserInput(input: string, context: SecurityContext): {
    isValid: boolean;
    sanitizedInput: string;
    warnings: string[];
} {
    const warnings: string[] = [];

    // Check for injection attempts
    const injection = detectInjectionAttempts(input);
    if (injection.detected) {
        warnings.push(...injection.indicators);
    }

    // Sanitize for logging (redact secrets)
    const sanitizedInput = sanitizeForLogging(input);

    // Input is always "valid" for processing - we just log and warn
    // The LLM will see the XML-wrapped version with injection warnings
    return {
        isValid: true,
        sanitizedInput,
        warnings
    };
}

/**
 * Get security context from request (set by middleware)
 */
export function getSecurityContext(req: Request): SecurityContext | undefined {
    return (req as any).securityContext;
}

/**
 * Check if request is from authenticated agent
 */
export function isAuthenticatedAgent(req: Request): boolean {
    const context = getSecurityContext(req);
    return context?.isAuthenticated === true && context?.sourceType === 'agent';
}

/**
 * Get audit log entries
 */
export async function getAuditLog(limit: number = 100): Promise<any[]> {
    try {
        if (!fs.existsSync(SECURITY_LOG_PATH)) {
            return [];
        }

        const content = fs.readFileSync(SECURITY_LOG_PATH, 'utf8');
        const lines = content.trim().split('\n').filter(Boolean);
        const entries = lines.map(line => {
            try {
                return JSON.parse(line);
            } catch {
                return null;
            }
        }).filter(Boolean);

        return entries.slice(-limit);
    } catch (error) {
        console.error('[Security] Failed to read audit log:', error);
        return [];
    }
}
