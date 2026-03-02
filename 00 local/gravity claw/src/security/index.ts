/**
 * Gravity Claw Security Module
 *
 * Core security infrastructure for the agent orchestration system.
 * Provides agent authentication, prompt injection defense, and API key protection.
 */

export {
    agentKeyRegistry,
    extractAgentKey,
    assessThreat,
    type AgentKeyMetadata,
    type AgentPermissions,
    type AgentKeyValidation,
    type ThreatAssessment
} from './agentKeys.js';

export {
    buildStructuredPrompt,
    buildInternalPrompt,
    wrapToolOutput,
    detectInjectionAttempts,
    sanitizeForLogging,
    parseStructuredPrompt,
    XML_TAGS,
    type StructuredPromptOptions,
    type ConversationMessage,
    type ToolResult
} from './promptStructure.js';

export {
    zeroTrustMiddleware,
    buildSecurityContext,
    validateUserInput,
    getSecurityContext,
    isAuthenticatedAgent,
    getAuditLog,
    type SecurityContext,
    type ZeroTrustConfig
} from './zeroTrust.js';

// Re-export commonly used validation function
export { agentKeyRegistry as keyRegistry } from './agentKeys.js';
