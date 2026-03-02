#!/usr/bin/env tsx
/**
 * Agent Key Generator CLI
 *
 * Usage:
 *   npx tsx scripts/generate-agent-key.ts <name> [--expires=30]
 *
 * Examples:
 *   npx tsx scripts/generate-agent-key.ts "main-agent"
 *   npx tsx scripts/generate-agent-key.ts "temp-agent" --expires=7
 *   npx tsx scripts/generate-agent-key.ts --list
 *   npx tsx scripts/generate-agent-key.ts --revoke=gc-agent-xxx
 */

import { agentKeyRegistry } from '../src/security/agentKeys.js';

const args = process.argv.slice(2);

function printUsage() {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║           GRAVITY CLAW - AGENT KEY GENERATOR                   ║
╚════════════════════════════════════════════════════════════════╝

Usage:
  npx tsx scripts/generate-agent-key.ts <name> [options]

Commands:
  <name>              Generate a new agent key with the given name
  --list              List all registered agent keys
  --revoke=<keyId>    Revoke an agent key

Options:
  --expires=<days>    Set expiration in days (default: no expiration)
  --no-tools          Disable tool execution permission
  --no-memory         Disable memory access permission
  --no-external       Disable external API access permission

Examples:
  npx tsx scripts/generate-agent-key.ts "main-agent"
  npx tsx scripts/generate-agent-key.ts "temp-agent" --expires=7
  npx tsx scripts/generate-agent-key.ts --list
  npx tsx scripts/generate-agent-key.ts --revoke=gc-agent-abc123
`);
}

async function main() {
    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
        printUsage();
        process.exit(0);
    }

    // List all keys
    if (args.includes('--list')) {
        const keys = agentKeyRegistry.getAllKeys();
        console.log('\n=== Registered Agent Keys ===\n');

        if (keys.length === 0) {
            console.log('No agent keys registered.\n');
            process.exit(0);
        }

        for (const key of keys) {
            const status = key.status === 'active' ? '✓' : key.status === 'revoked' ? '✗' : '⏱';
            console.log(`${status} ${key.name}`);
            console.log(`  ID: ${key.keyId}`);
            console.log(`  Status: ${key.status}`);
            console.log(`  Created: ${new Date(key.createdAt).toISOString()}`);
            console.log(`  Usage: ${key.usageCount} requests`);
            if (key.expiresAt) {
                console.log(`  Expires: ${new Date(key.expiresAt).toISOString()}`);
            }
            console.log('');
        }
        process.exit(0);
    }

    // Revoke a key
    const revokeArg = args.find(a => a.startsWith('--revoke='));
    if (revokeArg) {
        const keyId = revokeArg.split('=')[1];
        const success = agentKeyRegistry.revokeKey(keyId);
        if (success) {
            console.log(`✓ Agent key revoked: ${keyId}`);
        } else {
            console.error(`✗ Key not found: ${keyId}`);
            process.exit(1);
        }
        process.exit(0);
    }

    // Generate new key
    const name = args.find(a => !a.startsWith('--'));
    if (!name) {
        console.error('Error: Agent name is required');
        printUsage();
        process.exit(1);
    }

    // Parse options
    const expiresArg = args.find(a => a.startsWith('--expires='));
    const expiresInDays = expiresArg ? parseInt(expiresArg.split('=')[1]) : undefined;

    const permissions = {
        canAccessOpenAI: true,
        canAccessAnthropic: true,
        canAccessOpenRouter: true,
        canAccessOllama: true,
        canExecuteTools: !args.includes('--no-tools'),
        canAccessMemory: !args.includes('--no-memory'),
        canAccessExternalAPIs: !args.includes('--no-external')
    };

    // Generate the key
    const metadata = agentKeyRegistry.generateKey(name, permissions, expiresInDays);

    console.log(`
╔════════════════════════════════════════════════════════════════╗
║                    AGENT KEY GENERATED                         ║
╚════════════════════════════════════════════════════════════════╝

Name:     ${metadata.name}
Key ID:   ${metadata.keyId}
Status:   ${metadata.status}
Created:  ${new Date(metadata.createdAt).toISOString()}
${metadata.expiresAt ? `Expires:  ${new Date(metadata.expiresAt).toISOString()}` : 'Expires:  Never'}

Permissions:
  - Execute Tools:      ${permissions.canExecuteTools ? '✓' : '✗'}
  - Access Memory:      ${permissions.canAccessMemory ? '✓' : '✗'}
  - External APIs:      ${permissions.canAccessExternalAPIs ? '✓' : '✗'}
  - OpenAI:             ${permissions.canAccessOpenAI ? '✓' : '✗'}
  - Anthropic:          ${permissions.canAccessAnthropic ? '✓' : '✗'}
  - OpenRouter:         ${permissions.canAccessOpenRouter ? '✓' : '✗'}
  - Ollama:             ${permissions.canAccessOllama ? '✓' : '✗'}

IMPORTANT: Store this key securely. It cannot be retrieved again.

To use with the proxy, add this header to requests:
  X-Agent-Key: ${metadata.keyId}
`);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
