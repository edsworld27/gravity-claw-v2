#!/usr/bin/env tsx
/**
 * Gravity Claw Setup Verification
 *
 * Checks that the system is properly configured before running.
 *
 * Usage:
 *   npx tsx scripts/verify-setup.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment
dotenv.config();

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m'
};

interface CheckResult {
    name: string;
    status: 'pass' | 'warn' | 'fail';
    message: string;
}

const results: CheckResult[] = [];

function check(name: string, condition: boolean, passMsg: string, failMsg: string, isWarning = false): void {
    results.push({
        name,
        status: condition ? 'pass' : (isWarning ? 'warn' : 'fail'),
        message: condition ? passMsg : failMsg
    });
}

function fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
}

function envSet(key: string): boolean {
    return !!process.env[key] && process.env[key] !== '';
}

console.log(`
${colors.cyan}╔════════════════════════════════════════════════════════════════╗
║           GRAVITY CLAW - SETUP VERIFICATION                    ║
╚════════════════════════════════════════════════════════════════╝${colors.reset}
`);

// Directory checks
console.log(`${colors.cyan}▸ Checking directories...${colors.reset}`);
check('data directory', fileExists('data'), 'data/ exists', 'data/ missing - run npm run setup');
check('src directory', fileExists('src'), 'src/ exists', 'src/ missing');
check('node_modules', fileExists('node_modules'), 'Dependencies installed', 'Run npm install');

// Configuration files
console.log(`${colors.cyan}▸ Checking configuration files...${colors.reset}`);
check('.env file', fileExists('.env'), '.env exists', '.env missing - run npm run setup');
check('.gitignore', fileExists('.gitignore'), '.gitignore exists', '.gitignore missing', true);

// Security files
console.log(`${colors.cyan}▸ Checking security configuration...${colors.reset}`);
check('Agent secret', fileExists('data/.agent-secret'), 'Agent secret exists', 'No agent secret - run npm run setup');
check('Agent keys', fileExists('data/agent-keys.json'), 'Agent keys exist', 'No agent keys - run npm run setup');

// Check file permissions
if (fileExists('data/.agent-secret')) {
    const stats = fs.statSync('data/.agent-secret');
    const mode = (stats.mode & 0o777).toString(8);
    check('Secret permissions', mode === '600', 'Secure permissions (600)', `Insecure permissions (${mode})`, true);
}

// AI Provider configuration
console.log(`${colors.cyan}▸ Checking AI providers...${colors.reset}`);
const hasAnyProvider = envSet('ANTHROPIC_API_KEY') || envSet('OPENAI_API_KEY') ||
    envSet('OPENROUTER_API_KEY') || envSet('GROQ_API_KEY') || envSet('OLLAMA_URL');
check('AI provider', hasAnyProvider, 'At least one AI provider configured', 'No AI providers configured');

if (envSet('ANTHROPIC_API_KEY')) {
    const key = process.env.ANTHROPIC_API_KEY!;
    const isPlaceholder = key.includes('placeholder');
    check('Anthropic key', !isPlaceholder || envSet('USE_LOCAL_PROXY'),
        isPlaceholder ? 'Using placeholder (proxy mode)' : 'Real key configured',
        'Placeholder key without proxy enabled');
}

// Channel configuration
console.log(`${colors.cyan}▸ Checking messaging channels...${colors.reset}`);
const hasAnyChannel = envSet('TELEGRAM_BOT_TOKEN') || envSet('DISCORD_BOT_TOKEN') ||
    envSet('SLACK_BOT_TOKEN');
check('Messaging channel', hasAnyChannel, 'At least one channel configured', 'No channels configured', true);

// Proxy configuration
console.log(`${colors.cyan}▸ Checking proxy configuration...${colors.reset}`);
if (process.env.USE_LOCAL_PROXY === 'true') {
    check('Proxy env', fileExists('proxy/.env.real'), 'Proxy credentials exist', 'proxy/.env.real missing');
    check('Proxy server', fileExists('proxy/server.ts'), 'Proxy server exists', 'proxy/server.ts missing');
}

// Print results
console.log(`\n${colors.cyan}═══════════════════════════════════════════════════════════════${colors.reset}\n`);

let passCount = 0;
let warnCount = 0;
let failCount = 0;

for (const result of results) {
    let icon: string;
    let color: string;

    switch (result.status) {
        case 'pass':
            icon = '✓';
            color = colors.green;
            passCount++;
            break;
        case 'warn':
            icon = '⚠';
            color = colors.yellow;
            warnCount++;
            break;
        case 'fail':
            icon = '✗';
            color = colors.red;
            failCount++;
            break;
    }

    console.log(`${color}${icon}${colors.reset} ${result.name}: ${colors.dim}${result.message}${colors.reset}`);
}

console.log(`\n${colors.cyan}═══════════════════════════════════════════════════════════════${colors.reset}`);
console.log(`\n${colors.green}Passed: ${passCount}${colors.reset}  ${colors.yellow}Warnings: ${warnCount}${colors.reset}  ${colors.red}Failed: ${failCount}${colors.reset}\n`);

if (failCount > 0) {
    console.log(`${colors.red}Setup incomplete. Run: npm run setup${colors.reset}\n`);
    process.exit(1);
} else if (warnCount > 0) {
    console.log(`${colors.yellow}Setup complete with warnings. Review the items above.${colors.reset}\n`);
    process.exit(0);
} else {
    console.log(`${colors.green}All checks passed! Ready to run: npm run dev${colors.reset}\n`);
    process.exit(0);
}
