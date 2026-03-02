#!/usr/bin/env tsx
/**
 * Dev Mode - Skip Setup
 *
 * Bypasses all setup checks and creates minimal dev configuration.
 * Use this for development/testing when you don't need real API keys.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

// ============================================================================
// MISSION CONTROL COLOR PALETTE (Terminal ANSI)
// ============================================================================

const c = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',

    // Brand Colors (Mission Control palette)
    orange: '\x1b[38;2;229;133;15m',       // #E5850F - Primary brand
    blue: '\x1b[38;2;90;156;245m',         // #5A9CF5 - Info
    green: '\x1b[38;2;46;204;143m',        // #2ECC8F - Success
    red: '\x1b[38;2;217;85;85m',           // #D95555 - Error/Warning

    // Text hierarchy
    primary: '\x1b[38;2;222;222;222m',     // ~87% white
    secondary: '\x1b[38;2;153;153;153m',   // ~60% white
    muted: '\x1b[38;2;97;97;97m',          // ~38% white

    // Backgrounds
    bgRed: '\x1b[48;2;217;85;85m',
    bgOrange: '\x1b[48;2;229;133;15m',
};

const DEV_ENV_CONTENT = `# DEV MODE - Auto-generated placeholder config
# ═══════════════════════════════════════════════════════════════
# WARNING: These are NOT real credentials - for development only
# API calls WILL FAIL with these placeholder values
# ═══════════════════════════════════════════════════════════════

# Agent Configuration
AGENT_NAME=GravityClaw-Dev
AGENT_KEY_SECRET=dev-secret-do-not-use-in-production

# Dev Mode Flag
DEV_MODE=true
SKIP_SETUP=true

# Placeholder API endpoints (will fail if actually called)
OPENROUTER_API_KEY=dev-placeholder-key
ANTHROPIC_API_KEY=dev-placeholder-key

# Telegram (disabled in dev)
TELEGRAM_BOT_TOKEN=disabled
TELEGRAM_ENABLED=false

# Supabase (disabled in dev)
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=dev-anon-key
SUPABASE_ENABLED=false

# Mission Control
MISSION_CONTROL_PORT=3000
`;

const DEV_AGENT_KEY = {
    id: 'gc-agent-dev-0000000000000000',
    name: 'dev-agent',
    created: new Date().toISOString(),
    revoked: false,
    permissions: ['*'],
    note: 'Development mode agent key - not for production'
};

// ============================================================================
// UI HELPERS
// ============================================================================

function ok(text: string): void {
    console.log(`  ${c.green}●${c.reset} ${text}`);
}

function warn(text: string): void {
    console.log(`  ${c.orange}●${c.reset} ${c.orange}${text}${c.reset}`);
}

function info(text: string): void {
    console.log(`  ${c.blue}●${c.reset} ${c.secondary}${text}${c.reset}`);
}

function securityWarning(lines: string[]): void {
    console.log(`\n${c.bgRed}${c.bold}  ⚠  DEV MODE WARNING  ${c.reset}`);
    console.log(`${c.red}┌${'─'.repeat(58)}┐${c.reset}`);
    for (const line of lines) {
        console.log(`${c.red}│${c.reset} ${line.padEnd(56)} ${c.red}│${c.reset}`);
    }
    console.log(`${c.red}└${'─'.repeat(58)}┘${c.reset}`);
}

// ============================================================================
// SETUP FUNCTIONS
// ============================================================================

function ensureDirectory(dir: string): void {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function writeDevEnv(): void {
    const envPath = path.join(ROOT_DIR, '.env');

    if (fs.existsSync(envPath)) {
        const existing = fs.readFileSync(envPath, 'utf-8');
        if (!existing.includes('DEV_MODE=true')) {
            warn('.env exists but not in dev mode. Creating .env.dev instead.');
            fs.writeFileSync(path.join(ROOT_DIR, '.env.dev'), DEV_ENV_CONTENT);
            return;
        }
        ok('Dev .env already exists');
        return;
    }

    fs.writeFileSync(envPath, DEV_ENV_CONTENT);
    ok('Created dev .env file');
}

function writeDevAgentKey(): void {
    const dataDir = path.join(ROOT_DIR, 'data');
    ensureDirectory(dataDir);

    const keysPath = path.join(dataDir, 'agent-keys.json');

    let keys: typeof DEV_AGENT_KEY[] = [];
    if (fs.existsSync(keysPath)) {
        try {
            keys = JSON.parse(fs.readFileSync(keysPath, 'utf-8'));
            if (keys.some(k => k.id === DEV_AGENT_KEY.id)) {
                ok('Dev agent key already exists');
                return;
            }
        } catch {
            keys = [];
        }
    }

    keys.push(DEV_AGENT_KEY);
    fs.writeFileSync(keysPath, JSON.stringify(keys, null, 2));
    ok('Created dev agent key');
}

function writeMissionControlEnv(): void {
    const mcDir = path.join(ROOT_DIR, 'mission-control');
    if (!fs.existsSync(mcDir)) {
        warn('mission-control directory not found, skipping');
        return;
    }

    const mcEnvPath = path.join(mcDir, '.env.local');
    const mcEnvContent = `# Dev mode - Mission Control
# ═══════════════════════════════════════════════════════════════
# WARNING: Dev mode only - not for production
# ═══════════════════════════════════════════════════════════════

NEXT_PUBLIC_DEV_MODE=true
NEXT_PUBLIC_SANDBOX_MODE=true
NEXT_PUBLIC_SANDBOX_KEY=sandbox_key
NEXT_PUBLIC_API_URL=http://localhost:3001
`;

    if (!fs.existsSync(mcEnvPath)) {
        fs.writeFileSync(mcEnvPath, mcEnvContent);
        ok('Created mission-control .env.local');
    } else {
        ok('mission-control .env.local already exists');
    }
}

async function startMissionControl(): Promise<void> {
    const mcDir = path.join(ROOT_DIR, 'mission-control');

    if (!fs.existsSync(mcDir)) {
        console.log(`\n${c.red}●${c.reset} ${c.red}mission-control directory not found${c.reset}`);
        info('Run from project root or create mission-control app first');
        return;
    }

    console.log(`\n${c.orange}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
    console.log(`${c.bold}${c.orange}  Starting Mission Control (Sandbox Mode)${c.reset}`);
    console.log(`${c.orange}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
    console.log(`\n  ${c.blue}●${c.reset} ${c.secondary}Port:${c.reset} ${c.orange}3001${c.reset}`);
    console.log(`  ${c.blue}●${c.reset} ${c.secondary}URL:${c.reset}  ${c.blue}http://localhost:3001${c.reset}`);
    console.log(`  ${c.blue}●${c.reset} ${c.secondary}Key:${c.reset}  ${c.muted}sandbox_key${c.reset}\n`);

    const child = spawn('npm', ['run', 'dev:sandbox'], {
        cwd: mcDir,
        stdio: 'inherit',
        shell: true
    });

    child.on('error', (err) => {
        console.error(`${c.red}Failed to start Mission Control:${c.reset}`, err.message);
    });
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
    console.clear();

    console.log(`${c.orange}
    ██████╗ ██████╗  █████╗ ██╗   ██╗██╗████████╗██╗   ██╗
   ██╔════╝ ██╔══██╗██╔══██╗██║   ██║██║╚══██╔══╝╚██╗ ██╔╝
   ██║  ███╗██████╔╝███████║██║   ██║██║   ██║    ╚████╔╝
   ██║   ██║██╔══██╗██╔══██║╚██╗ ██╔╝██║   ██║     ╚██╔╝
   ╚██████╔╝██║  ██║██║  ██║ ╚████╔╝ ██║   ██║      ██║
    ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚═╝   ╚═╝      ╚═╝

    ██████╗██╗      █████╗ ██╗    ██╗
   ██╔════╝██║     ██╔══██╗██║    ██║
   ██║     ██║     ███████║██║ █╗ ██║
   ██║     ██║     ██╔══██║██║███╗██║
   ╚██████╗███████╗██║  ██║╚███╔███╔╝
    ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝
${c.reset}
${c.muted}                      DEV MODE${c.reset}
${c.muted}                  Bypassing Setup${c.reset}
`);

    securityWarning([
        `${c.bold}DEV MODE IS NOT SECURE${c.reset}`,
        '',
        `${c.orange}•${c.reset} API calls will FAIL (placeholder keys)`,
        `${c.orange}•${c.reset} No real authentication`,
        `${c.orange}•${c.reset} For UI/dashboard testing ONLY`,
        '',
        'Run full setup (npm run setup) for production.'
    ]);

    console.log(`\n${c.orange}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
    console.log(`${c.bold}${c.orange}  Creating Dev Configuration${c.reset}`);
    console.log(`${c.orange}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);

    writeDevEnv();
    writeDevAgentKey();
    writeMissionControlEnv();

    console.log(`
${c.green}●${c.reset} ${c.bold}Dev mode configured!${c.reset}

${c.muted}┌${'─'.repeat(56)}┐${c.reset}
${c.muted}│${c.reset} ${c.secondary}API calls will fail - this is for UI testing only.${c.reset}     ${c.muted}│${c.reset}
${c.muted}│${c.reset} ${c.secondary}Run${c.reset} ${c.orange}npm run setup${c.reset} ${c.secondary}for working API connections.${c.reset}      ${c.muted}│${c.reset}
${c.muted}└${'─'.repeat(56)}┘${c.reset}
`);

    // Start Mission Control
    await startMissionControl();
}

main().catch(console.error);
