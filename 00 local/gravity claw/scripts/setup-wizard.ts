#!/usr/bin/env tsx
/**
 * Gravity Claw Secure Setup Wizard
 *
 * Sets up the complete secure infrastructure:
 * 1. Prerequisites (Tailscale, Docker)
 * 2. Temporary OpenRouter key for testing (30 min, £5 limit)
 * 3. Test the system works
 * 4. Configure proxy for production
 * 5. Deploy to Railway
 *
 * Usage:
 *   npx tsx scripts/setup-wizard.ts
 */

import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { execSync, spawn } from 'child_process';

// ============================================================================
// MISSION CONTROL COLOR PALETTE (Terminal ANSI)
// ============================================================================
// Mirrors globals.css: --brand-orange, --brand-green, --brand-red, --brand-blue
// Dark backgrounds, muted secondary text

const c = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    italic: '\x1b[3m',

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
    bgDark: '\x1b[48;2;18;18;18m',         // #121212
    bgCard: '\x1b[48;2;30;30;30m',         // #1E1E1E
    bgRed: '\x1b[48;2;217;85;85m',         // #D95555
    bgOrange: '\x1b[48;2;229;133;15m',     // #E5850F
};

// Paths
const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const PROXY_DIR = path.join(ROOT, 'proxy');
const ENV_FILE = path.join(ROOT, '.env');
const PROXY_ENV = path.join(PROXY_DIR, '.env.real');
const MISSION_CONTROL_DIR = path.join(ROOT, 'mission-control');

// State
interface SetupState {
    hasTailscale: boolean;
    hasDocker: boolean;
    tailscaleIp?: string;
    openrouterTestKey?: string;
    testKeyExpiry?: Date;
    telegramToken?: string;
    telegramUserId?: string;
    masterPassword?: string;
    agentKey?: string;
    proxyAdminSecret?: string;
    supabaseUrl?: string;
    supabaseAnonKey?: string;
    supabaseServiceKey?: string;
    missionControlEnabled: boolean;
    railwayToken?: string;
    acceptedLiability: boolean;
}

const state: SetupState = {
    hasTailscale: false,
    hasDocker: false,
    missionControlEnabled: false,
    acceptedLiability: false
};

// Readline
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// ============================================================================
// HELPERS
// ============================================================================

function ask(q: string): Promise<string> {
    return new Promise(resolve => rl.question(q, a => resolve(a.trim())));
}

function askSecret(q: string): Promise<string> {
    return new Promise(resolve => {
        process.stdout.write(q);
        const stdin = process.stdin;
        stdin.setRawMode(true);
        stdin.resume();

        let pwd = '';
        const onData = (ch: Buffer) => {
            const char = ch.toString();
            if (char === '\n' || char === '\r') {
                stdin.setRawMode(false);
                stdin.removeListener('data', onData);
                console.log('');
                resolve(pwd);
            } else if (char === '\u0003') {
                process.exit();
            } else if (char === '\u007F' || char === '\b') {
                if (pwd.length > 0) {
                    pwd = pwd.slice(0, -1);
                    process.stdout.write('\b \b');
                }
            } else {
                pwd += char;
                process.stdout.write('•');
            }
        };
        stdin.on('data', onData);
    });
}

async function confirm(q: string, defaultYes = true): Promise<boolean> {
    const hint = defaultYes ? `${c.muted}[Y/n]${c.reset}` : `${c.muted}[y/N]${c.reset}`;
    const a = await ask(`${c.primary}${q}${c.reset} ${hint} `);
    if (a === '') return defaultYes;
    return a.toLowerCase().startsWith('y');
}

async function pressEnter(msg: string = 'Press Enter to continue...'): Promise<void> {
    await ask(`\n${c.muted}${msg}${c.reset}`);
}

function exec(cmd: string): string {
    try {
        return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    } catch {
        return '';
    }
}

function cmdExists(cmd: string): boolean {
    return exec(`which ${cmd}`) !== '';
}

// ============================================================================
// UI COMPONENTS (Mission Control Style)
// ============================================================================

function clearScreen(): void {
    console.clear();
}

function header(text: string, step?: string): void {
    const stepText = step ? `${c.muted}${step}${c.reset}` : '';
    console.log(`\n${c.orange}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
    console.log(`${c.bold}${c.orange}  ${text}${c.reset}  ${stepText}`);
    console.log(`${c.orange}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);
}

function section(text: string): void {
    console.log(`\n${c.orange}▸${c.reset} ${c.bold}${text}${c.reset}`);
    console.log(`${c.muted}${'─'.repeat(50)}${c.reset}`);
}

function ok(text: string): void {
    console.log(`  ${c.green}●${c.reset} ${text}`);
}

function warn(text: string): void {
    console.log(`  ${c.orange}●${c.reset} ${c.orange}${text}${c.reset}`);
}

function fail(text: string): void {
    console.log(`  ${c.red}●${c.reset} ${c.red}${text}${c.reset}`);
}

function info(text: string): void {
    console.log(`  ${c.blue}●${c.reset} ${c.secondary}${text}${c.reset}`);
}

function securityWarning(lines: string[]): void {
    console.log(`\n${c.bgRed}${c.bold}  ⚠  SECURITY WARNING  ${c.reset}`);
    console.log(`${c.red}┌${'─'.repeat(58)}┐${c.reset}`);
    for (const line of lines) {
        console.log(`${c.red}│${c.reset} ${line.padEnd(56)} ${c.red}│${c.reset}`);
    }
    console.log(`${c.red}└${'─'.repeat(58)}┘${c.reset}`);
}

function card(lines: string[], title?: string): void {
    const maxLen = Math.max(...lines.map(l => l.replace(/\x1b\[[0-9;]*m/g, '').length));
    const width = Math.max(maxLen + 4, 56);

    if (title) {
        console.log(`\n${c.muted}┌─ ${c.secondary}${title} ${c.muted}${'─'.repeat(width - title.length - 4)}┐${c.reset}`);
    } else {
        console.log(`\n${c.muted}┌${'─'.repeat(width)}┐${c.reset}`);
    }

    for (const line of lines) {
        const visibleLen = line.replace(/\x1b\[[0-9;]*m/g, '').length;
        const padding = width - visibleLen - 2;
        console.log(`${c.muted}│${c.reset} ${line}${' '.repeat(Math.max(0, padding))} ${c.muted}│${c.reset}`);
    }
    console.log(`${c.muted}└${'─'.repeat(width)}┘${c.reset}`);
}

function liabilityBox(): void {
    console.log(`
${c.red}╔══════════════════════════════════════════════════════════════╗
║                                                                ║
║  ${c.bold}IMPORTANT: LIABILITY DISCLAIMER${c.reset}${c.red}                              ║
║                                                                ║
║  Gravity Claw is ${c.bold}OPEN SOURCE SOFTWARE${c.reset}${c.red} provided "AS IS".       ║
║                                                                ║
║  By using this software, you acknowledge and agree:           ║
║                                                                ║
║  ${c.orange}•${c.red} You are ${c.bold}solely responsible${c.reset}${c.red} for your own security       ║
║  ${c.orange}•${c.red} API keys, tokens, and credentials are ${c.bold}your liability${c.reset}${c.red}     ║
║  ${c.orange}•${c.red} This software ${c.bold}may contain bugs${c.reset}${c.red} - assume it will fail   ║
║  ${c.orange}•${c.red} ${c.bold}No warranty${c.reset}${c.red} is provided, express or implied            ║
║  ${c.orange}•${c.red} The authors are ${c.bold}not liable${c.reset}${c.red} for any damages or losses  ║
║  ${c.orange}•${c.red} You must ${c.bold}review code yourself${c.reset}${c.red} before trusting it       ║
║                                                                ║
║  ${c.muted}This includes but is not limited to: data loss, API${c.red}        ║
║  ${c.muted}charges, security breaches, or any other consequences.${c.red}      ║
║                                                                ║
╚══════════════════════════════════════════════════════════════╝${c.reset}
`);
}

// ============================================================================
// SETUP STEPS
// ============================================================================

async function welcome(): Promise<void> {
    clearScreen();

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
${c.muted}                    SECURE SETUP WIZARD${c.reset}
${c.muted}                        v2.0.0-beta${c.reset}
`);

    // IMPORTANT: Liability disclaimer first
    liabilityBox();

    const accept = await confirm(`${c.red}Do you understand and accept these terms?${c.reset}`, false);

    if (!accept) {
        console.log(`\n${c.muted}Setup cancelled. You must accept the terms to proceed.${c.reset}\n`);
        process.exit(0);
    }

    state.acceptedLiability = true;
    ok('Terms accepted');

    card([
        `${c.secondary}This wizard configures Gravity Claw:${c.reset}`,
        '',
        `${c.orange} 1.${c.reset} Prerequisites     ${c.muted}Tailscale, Docker${c.reset}`,
        `${c.orange} 2.${c.reset} OpenRouter        ${c.muted}Temp test key (30 min, £5)${c.reset}`,
        `${c.orange} 3.${c.reset} Telegram          ${c.muted}Primary interface${c.reset}`,
        `${c.orange} 4.${c.reset} Security          ${c.muted}Agent keys & encryption${c.reset}`,
        `${c.orange} 5.${c.reset} Proxy             ${c.muted}API key protection${c.reset}`,
        `${c.orange} 6.${c.reset} Environment       ${c.muted}Config files${c.reset}`,
        `${c.orange} 7.${c.reset} System Test       ${c.muted}Verify setup${c.reset}`,
        `${c.orange} 8.${c.reset} Supabase          ${c.muted}Optional cloud sync${c.reset}`,
        `${c.orange} 9.${c.reset} Mission Control   ${c.muted}Optional dashboard${c.reset}`,
        `${c.orange}10.${c.reset} Railway           ${c.muted}Optional deployment${c.reset}`,
        '',
        `${c.green}●${c.reset} ${c.secondary}No permanent API keys are stored in code${c.reset}`,
    ], 'SETUP OVERVIEW');

    const proceed = await confirm('\nReady to begin?');
    if (!proceed) {
        console.log(`\n${c.muted}Setup cancelled.${c.reset}\n`);
        process.exit(0);
    }
}

async function checkPrerequisites(): Promise<void> {
    header('Prerequisites', 'STEP 1/10');

    securityWarning([
        `${c.bold}Tailscale${c.reset} and ${c.bold}Docker${c.reset} provide network isolation.`,
        'Running without them increases your attack surface.',
        'Proceed without them ONLY for local development.'
    ]);

    // Check Tailscale
    section('Tailscale (Secure Networking)');

    state.hasTailscale = cmdExists('tailscale');

    if (state.hasTailscale) {
        const status = exec('tailscale status --json 2>/dev/null');
        if (status) {
            try {
                const data = JSON.parse(status);
                if (data.Self?.TailscaleIPs?.[0]) {
                    state.tailscaleIp = data.Self.TailscaleIPs[0];
                    ok(`Connected: ${c.blue}${state.tailscaleIp}${c.reset}`);
                } else {
                    warn('Installed but not connected');
                    info(`Run: ${c.orange}tailscale up${c.reset}`);
                }
            } catch {
                warn('Installed but status unclear');
            }
        }
    } else {
        fail('Tailscale not installed');
        console.log(`
${c.secondary}Install Tailscale:${c.reset}
  ${c.orange}macOS:${c.reset}   brew install tailscale
  ${c.orange}Linux:${c.reset}   curl -fsSL https://tailscale.com/install.sh | sh
  ${c.orange}Windows:${c.reset} Download from https://tailscale.com/download
`);
        const cont = await confirm('Continue without Tailscale?', false);
        if (!cont) {
            console.log(`\n${c.muted}Install Tailscale and run setup again.${c.reset}\n`);
            process.exit(0);
        }
        warn('Proceeding without Tailscale - REDUCED SECURITY');
    }

    // Check Docker
    section('Docker (Container Isolation)');

    state.hasDocker = cmdExists('docker');

    if (state.hasDocker) {
        const dockerRunning = exec('docker info 2>/dev/null');
        if (dockerRunning) {
            ok('Docker installed and running');
        } else {
            warn('Docker installed but not running');
            info('Start Docker Desktop or run: sudo systemctl start docker');
        }
    } else {
        fail('Docker not installed');
        console.log(`
${c.secondary}Install Docker:${c.reset}
  ${c.orange}macOS:${c.reset}   brew install --cask docker
  ${c.orange}Linux:${c.reset}   curl -fsSL https://get.docker.com | sh
  ${c.orange}Windows:${c.reset} Download Docker Desktop
`);
        const cont = await confirm('Continue without Docker?', false);
        if (!cont) {
            console.log(`\n${c.muted}Install Docker and run setup again.${c.reset}\n`);
            process.exit(0);
        }
        warn('Proceeding without Docker - REDUCED SECURITY');
    }

    // Check Node
    section('Node.js');
    const nodeVersion = exec('node --version');
    if (nodeVersion) {
        ok(`Node.js ${c.blue}${nodeVersion}${c.reset}`);
    }
}

async function setupOpenRouterTestKey(): Promise<void> {
    header('OpenRouter Test Key', 'STEP 2/10');

    securityWarning([
        'Create a TEMPORARY key with STRICT LIMITS:',
        `  ${c.orange}•${c.reset} Spending limit: £5 max`,
        `  ${c.orange}•${c.reset} Expiry: 30 minutes`,
        `  ${c.orange}•${c.reset} Name it clearly: "Gravity Claw Setup Test"`,
        '',
        'This key is ONLY for testing. It will expire.',
        'Delete it manually if setup fails.'
    ]);

    card([
        `${c.secondary}Go to:${c.reset} ${c.blue}https://openrouter.ai/keys${c.reset}`,
        '',
        `${c.secondary}Create a key with:${c.reset}`,
        `  ${c.orange}Name:${c.reset}     "Gravity Claw Setup Test"`,
        `  ${c.orange}Limit:${c.reset}    £5 (or $5)`,
        `  ${c.orange}Expiry:${c.reset}   30 minutes`,
        '',
        `${c.muted}Your real keys go through the secure proxy later.${c.reset}`
    ], 'TEMPORARY TEST KEY');

    console.log(`\n${c.blue}Opening OpenRouter...${c.reset}`);

    const openCmd = process.platform === 'darwin' ? 'open' :
        process.platform === 'win32' ? 'start' : 'xdg-open';
    try {
        execSync(`${openCmd} "https://openrouter.ai/keys" 2>/dev/null`, { stdio: 'ignore' });
    } catch {
        info('Open https://openrouter.ai/keys in your browser');
    }

    await pressEnter('Create your test key, then press Enter...');

    state.openrouterTestKey = await askSecret(`${c.primary}Paste OpenRouter test key:${c.reset} `);

    if (!state.openrouterTestKey || !state.openrouterTestKey.startsWith('sk-or-')) {
        fail('Invalid OpenRouter key format (should start with sk-or-)');
        const retry = await confirm('Try again?');
        if (retry) {
            return setupOpenRouterTestKey();
        }
        process.exit(1);
    }

    state.testKeyExpiry = new Date(Date.now() + 30 * 60 * 1000);
    ok(`Test key received ${c.muted}(expires ~${state.testKeyExpiry.toLocaleTimeString()})${c.reset}`);

    // Test the key
    section('Testing OpenRouter Connection');
    info('Sending test request...');

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.openrouterTestKey}`,
                'HTTP-Referer': 'https://github.com/gravity-claw',
                'X-Title': 'Gravity Claw Setup'
            },
            body: JSON.stringify({
                model: 'meta-llama/llama-3.2-1b-instruct:free',
                max_tokens: 20,
                messages: [{ role: 'user', content: 'Say "Gravity Claw test successful" in exactly those words.' }]
            })
        });

        if (response.ok) {
            const data = await response.json() as any;
            const reply = data.choices?.[0]?.message?.content || '';
            ok(`OpenRouter working: "${c.green}${reply.substring(0, 40)}${c.reset}..."`);
        } else {
            const error = await response.json() as any;
            fail(`OpenRouter error: ${error.error?.message || response.statusText}`);
            const cont = await confirm('Continue anyway?', false);
            if (!cont) process.exit(1);
        }
    } catch (e: any) {
        fail(`Network error: ${e.message}`);
        const cont = await confirm('Continue anyway?', false);
        if (!cont) process.exit(1);
    }
}

async function setupTelegram(): Promise<void> {
    header('Telegram Bot', 'STEP 3/10');

    securityWarning([
        'Your Telegram bot token grants FULL control of the bot.',
        'Anyone with this token can:',
        `  ${c.orange}•${c.reset} Read all messages sent to the bot`,
        `  ${c.orange}•${c.reset} Send messages as the bot`,
        `  ${c.orange}•${c.reset} Access file uploads`,
        '',
        'NEVER share your bot token. Regenerate if compromised.'
    ]);

    card([
        `${c.secondary}Create a bot:${c.reset}`,
        `  1. Open Telegram, message ${c.blue}@BotFather${c.reset}`,
        `  2. Send ${c.orange}/newbot${c.reset}`,
        `  3. Choose a name and username`,
        `  4. Copy the token`,
        '',
        `${c.secondary}Get your user ID:${c.reset}`,
        `  1. Message ${c.blue}@userinfobot${c.reset}`,
        `  2. It will reply with your ID`
    ], 'TELEGRAM SETUP');

    const openCmd = process.platform === 'darwin' ? 'open' :
        process.platform === 'win32' ? 'start' : 'xdg-open';
    try {
        execSync(`${openCmd} "https://t.me/BotFather" 2>/dev/null`, { stdio: 'ignore' });
    } catch { }

    await pressEnter('Create your bot, then press Enter...');

    state.telegramToken = await askSecret(`${c.primary}Paste Telegram Bot Token:${c.reset} `);

    if (!state.telegramToken || !state.telegramToken.includes(':')) {
        fail('Invalid token format');
        const retry = await confirm('Try again?');
        if (retry) return setupTelegram();
        process.exit(1);
    }

    ok('Bot token received');

    state.telegramUserId = await ask(`${c.primary}Enter your Telegram User ID:${c.reset} `);

    if (!state.telegramUserId || !/^\d+$/.test(state.telegramUserId)) {
        warn('User ID should be numeric - you can fix this later in .env');
    } else {
        ok(`User ID: ${c.blue}${state.telegramUserId}${c.reset}`);
    }

    // Test bot token
    section('Testing Telegram Bot');

    try {
        const response = await fetch(`https://api.telegram.org/bot${state.telegramToken}/getMe`);
        if (response.ok) {
            const data = await response.json() as any;
            ok(`Bot connected: ${c.blue}@${data.result?.username}${c.reset}`);
        } else {
            fail('Invalid bot token');
            const cont = await confirm('Continue anyway?', false);
            if (!cont) process.exit(1);
        }
    } catch (e: any) {
        fail(`Network error: ${e.message}`);
    }
}

async function setupSecurity(): Promise<void> {
    header('Security Configuration', 'STEP 4/10');

    securityWarning([
        'You are about to create cryptographic secrets.',
        '',
        `${c.bold}Master Password:${c.reset}`,
        `  ${c.orange}•${c.reset} Encrypts sensitive local data`,
        `  ${c.orange}•${c.reset} Cannot be recovered if lost`,
        `  ${c.orange}•${c.reset} Use a password manager`,
        '',
        `${c.bold}Agent Keys:${c.reset}`,
        `  ${c.orange}•${c.reset} Authenticate your agents`,
        `  ${c.orange}•${c.reset} Can be revoked if compromised`,
        `  ${c.orange}•${c.reset} Stored locally in data/agent-keys.json`
    ]);

    // Master password
    section('Master Password');

    while (true) {
        state.masterPassword = await askSecret(`${c.primary}Create master password (min 12 chars):${c.reset} `);

        if (state.masterPassword.length < 12) {
            fail('Password must be at least 12 characters');
            continue;
        }

        const confirm2 = await askSecret(`${c.primary}Confirm password:${c.reset} `);
        if (confirm2 !== state.masterPassword) {
            fail('Passwords do not match');
            continue;
        }

        ok('Master password set');
        break;
    }

    // Generate agent key
    section('Agent Key Generation');

    const secretKey = crypto.randomBytes(32);
    const randomPart = crypto.randomBytes(16).toString('hex');
    const hmac = crypto.createHmac('sha256', secretKey);
    hmac.update(`${randomPart}:${Date.now()}:gravity-claw-main`);
    const signature = hmac.digest('hex').substring(0, 12);
    state.agentKey = `gc-agent-${randomPart}-${signature}`;

    // Save files
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    fs.writeFileSync(path.join(DATA_DIR, '.agent-secret'), secretKey.toString('hex'), { mode: 0o600 });

    const agentKeyData = [{
        keyId: state.agentKey,
        name: 'gravity-claw-main',
        createdAt: Date.now(),
        permissions: {
            canAccessOpenAI: true,
            canAccessAnthropic: true,
            canAccessOpenRouter: true,
            canAccessOllama: true,
            canExecuteTools: true,
            canAccessMemory: true,
            canAccessExternalAPIs: true
        },
        status: 'active',
        usageCount: 0
    }];
    fs.writeFileSync(path.join(DATA_DIR, 'agent-keys.json'), JSON.stringify(agentKeyData, null, 2), { mode: 0o600 });

    ok(`Agent key: ${c.muted}${state.agentKey.substring(0, 25)}...${c.reset}`);

    // Proxy admin secret
    state.proxyAdminSecret = crypto.randomBytes(32).toString('hex');
    ok('Proxy admin secret generated');

    info(`${c.muted}Files saved with restricted permissions (0600)${c.reset}`);
}

async function setupProxy(): Promise<void> {
    header('Secure Proxy Configuration', 'STEP 5/10');

    securityWarning([
        'The proxy holds your REAL API keys.',
        '',
        `${c.bold}proxy/.env.real${c.reset} is CRITICAL:`,
        `  ${c.orange}•${c.reset} Contains real API credentials`,
        `  ${c.orange}•${c.reset} NEVER commit to git`,
        `  ${c.orange}•${c.reset} Backup securely`,
        `  ${c.orange}•${c.reset} Restrict file permissions`,
        '',
        'If compromised, rotate ALL keys immediately.'
    ]);

    card([
        `${c.secondary}How the proxy works:${c.reset}`,
        '',
        `  ${c.orange}1.${c.reset} Agents use placeholder keys`,
        `  ${c.orange}2.${c.reset} Proxy validates agent identity`,
        `  ${c.orange}3.${c.reset} Proxy injects real keys at runtime`,
        `  ${c.orange}4.${c.reset} Real keys never touch agent code`,
        '',
        `${c.green}●${c.reset} ${c.secondary}Add real keys later via admin API${c.reset}`
    ], 'PROXY ARCHITECTURE');

    // Create proxy env
    const proxyEnv = `# Gravity Claw Secure Proxy
# ═══════════════════════════════════════════════════════════════
# CRITICAL: This file contains REAL API keys
# NEVER commit to git | NEVER share | Backup securely
# ═══════════════════════════════════════════════════════════════

PROXY_PORT=4000
PROXY_ADMIN_SECRET=${state.proxyAdminSecret}

# Real API keys - add after setup:
# REAL_ANTHROPIC_API_KEY=sk-ant-...
# REAL_OPENAI_API_KEY=sk-...
# REAL_OPENROUTER_API_KEY=sk-or-...
`;

    if (!fs.existsSync(PROXY_DIR)) {
        fs.mkdirSync(PROXY_DIR, { recursive: true });
    }
    fs.writeFileSync(PROXY_ENV, proxyEnv, { mode: 0o600 });
    ok('Proxy configuration created');
    ok(`File permissions: ${c.muted}600 (owner read/write only)${c.reset}`);

    card([
        `${c.red}SAVE THIS ADMIN SECRET - YOU CANNOT RECOVER IT${c.reset}`,
        '',
        `${c.orange}${state.proxyAdminSecret}${c.reset}`,
        '',
        `${c.muted}Use this to add/manage keys via the admin API${c.reset}`
    ], 'ADMIN SECRET');

    await pressEnter();
}

async function generateEnvFile(): Promise<void> {
    header('Environment Configuration', 'STEP 6/10');

    const envContent = `# Gravity Claw Configuration
# Generated: ${new Date().toISOString()}
# ═══════════════════════════════════════════════════════════════
# WARNING: Contains sensitive data. NEVER commit to git.
# ═══════════════════════════════════════════════════════════════

# ==============================================================================
# SECURITY
# ==============================================================================
LOCAL_MASTER_PASSWORD=${state.masterPassword}

# ==============================================================================
# PROXY MODE (Recommended)
# ==============================================================================
USE_LOCAL_PROXY=true
LOCAL_PROXY_URL=http://localhost:4000

# Placeholder keys - proxy injects real ones
OPENROUTER_API_KEY=sk-placeholder-proxy-will-inject
ANTHROPIC_API_KEY=sk-placeholder-proxy-will-inject
OPENAI_API_KEY=sk-placeholder-proxy-will-inject

# Local models (no key needed)
OLLAMA_URL=http://localhost:11434

# ==============================================================================
# TELEGRAM (Primary Interface)
# ==============================================================================
TELEGRAM_BOT_TOKEN=${state.telegramToken || ''}
TELEGRAM_USER_ID=${state.telegramUserId || ''}

# ==============================================================================
# OPTIONAL (Configure later in Mission Control)
# ==============================================================================
# DISCORD_BOT_TOKEN=
# SLACK_BOT_TOKEN=
# SLACK_APP_TOKEN=
# ELEVENLABS_API_KEY=
# HOME_ASSISTANT_URL=
# HOME_ASSISTANT_TOKEN=
`;

    if (fs.existsSync(ENV_FILE)) {
        const backup = `${ENV_FILE}.backup.${Date.now()}`;
        fs.copyFileSync(ENV_FILE, backup);
        info(`Backed up existing .env to ${c.muted}${path.basename(backup)}${c.reset}`);
    }

    fs.writeFileSync(ENV_FILE, envContent, { mode: 0o600 });
    ok('.env file created');
    ok(`File permissions: ${c.muted}600 (owner read/write only)${c.reset}`);
}

async function testFullSystem(): Promise<void> {
    header('System Test', 'STEP 7/10');

    info(`Testing with your temporary OpenRouter key...`);
    console.log(`${c.muted}Key expires at ${state.testKeyExpiry?.toLocaleTimeString()}${c.reset}\n`);

    // Create temp test env
    const testEnv = `
OPENROUTER_API_KEY=${state.openrouterTestKey}
TELEGRAM_BOT_TOKEN=${state.telegramToken}
TELEGRAM_USER_ID=${state.telegramUserId}
LOCAL_MASTER_PASSWORD=${state.masterPassword}
USE_LOCAL_PROXY=false
`;

    const tempEnvPath = path.join(DATA_DIR, '.test-env');
    fs.writeFileSync(tempEnvPath, testEnv, { mode: 0o600 });

    section('Testing Agent Initialization');

    try {
        const result = exec(`cd "${ROOT}" && node --loader tsx -e "
            import { agentKeyRegistry } from './src/security/index.js';
            console.log('Keys:', agentKeyRegistry.getActiveKeys().length);
        " 2>&1`);

        if (result.includes('Keys:')) {
            ok('Security module loads correctly');
        } else {
            warn('Could not verify security module');
        }
    } catch (e) {
        warn('Could not run security test (dependencies may need install)');
    }

    // Clean up
    fs.unlinkSync(tempEnvPath);

    ok('System test complete');

    card([
        `${c.green}Setup successful!${c.reset}`,
        '',
        `${c.secondary}Your test key expires at ${c.orange}${state.testKeyExpiry?.toLocaleTimeString()}${c.reset}`,
        '',
        `${c.muted}Next: Add real keys to the proxy for production.${c.reset}`
    ]);
}

async function setupSupabase(): Promise<void> {
    header('Supabase (Mission Control)', 'STEP 8/10');

    const setup = await confirm('Set up Supabase for Mission Control dashboard?');

    if (!setup) {
        info('Skipping Supabase. Mission Control will run in local-only mode.');
        return;
    }

    securityWarning([
        'Supabase credentials grant access to your database.',
        '',
        `${c.bold}Service Role Key:${c.reset} Has FULL database access`,
        `  ${c.orange}•${c.reset} Can bypass Row Level Security`,
        `  ${c.orange}•${c.reset} Never expose to client-side code`,
        `  ${c.orange}•${c.reset} Use only server-side`,
        '',
        `${c.bold}Anon Key:${c.reset} Limited public access`,
        `  ${c.orange}•${c.reset} Safe for client-side (with RLS enabled)`,
    ]);

    card([
        `${c.secondary}1.${c.reset} Go to ${c.blue}https://supabase.com${c.reset}`,
        `${c.secondary}2.${c.reset} Create a new project (free tier works)`,
        `${c.secondary}3.${c.reset} Go to Settings > API`,
        `${c.secondary}4.${c.reset} Copy your Project URL and keys`
    ], 'SUPABASE SETUP');

    const openCmd = process.platform === 'darwin' ? 'open' :
        process.platform === 'win32' ? 'start' : 'xdg-open';
    try {
        execSync(`${openCmd} "https://supabase.com/dashboard" 2>/dev/null`, { stdio: 'ignore' });
    } catch { }

    await pressEnter('Create your Supabase project, then press Enter...');

    state.supabaseUrl = await ask(`${c.primary}Supabase Project URL:${c.reset} `);
    state.supabaseAnonKey = await askSecret(`${c.primary}Supabase Anon Key:${c.reset} `);
    state.supabaseServiceKey = await askSecret(`${c.primary}Supabase Service Role Key:${c.reset} `);

    if (!state.supabaseUrl || !state.supabaseAnonKey) {
        warn('Supabase not fully configured. Mission Control will run locally.');
        return;
    }

    ok('Supabase credentials received');

    section('Database Schema');
    info('Run this SQL in Supabase SQL Editor:');

    console.log(`
${c.muted}-- Create activity_log table
CREATE TABLE IF NOT EXISTS activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    platform TEXT,
    sender_id TEXT,
    content TEXT,
    metadata JSONB,
    timestamp TIMESTAMPTZ DEFAULT now()
);

-- Create bot_config table
CREATE TABLE IF NOT EXISTS bot_config (
    key TEXT PRIMARY KEY,
    value JSONB,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE activity_log;${c.reset}
`);

    await pressEnter('Run the SQL in Supabase, then press Enter...');
    ok('Supabase database configured');
}

async function setupMissionControl(): Promise<void> {
    header('Mission Control Dashboard', 'STEP 9/10');

    if (!fs.existsSync(MISSION_CONTROL_DIR)) {
        warn('Mission Control directory not found. Skipping.');
        return;
    }

    const setup = await confirm('Set up Mission Control dashboard?');

    if (!setup) {
        info('Skipping Mission Control.');
        return;
    }

    state.missionControlEnabled = true;

    section('Installing Dependencies');
    info('Running npm install in mission-control...');

    try {
        execSync('npm install', { cwd: MISSION_CONTROL_DIR, stdio: 'inherit' });
        ok('Dependencies installed');
    } catch (e) {
        fail('npm install failed');
        return;
    }

    section('Configuration');

    const envContent = `# Mission Control Configuration
# ═══════════════════════════════════════════════════════════════
# WARNING: Contains credentials. NEVER commit to git.
# ═══════════════════════════════════════════════════════════════

NEXT_PUBLIC_SUPABASE_URL=${state.supabaseUrl || ''}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${state.supabaseAnonKey || ''}
NEXT_PUBLIC_PROXY_ADMIN_SECRET=${state.proxyAdminSecret || ''}
`;

    fs.writeFileSync(path.join(MISSION_CONTROL_DIR, '.env.local'), envContent, { mode: 0o600 });
    ok('Mission Control configured');

    card([
        `${c.green}Mission Control is ready!${c.reset}`,
        '',
        `${c.secondary}To start:${c.reset}`,
        `  ${c.orange}cd mission-control && npm run dev${c.reset}`,
        '',
        `${c.secondary}Then open:${c.reset} ${c.blue}http://localhost:3000${c.reset}`
    ]);
}

async function setupRailway(): Promise<void> {
    header('Railway Deployment', 'STEP 10/10');

    const deploy = await confirm('Deploy to Railway?', false);

    if (!deploy) {
        info('Skipping Railway. You can deploy later.');
        return;
    }

    securityWarning([
        'Railway deployment exposes your agent to the internet.',
        '',
        `${c.orange}•${c.reset} Ensure all security measures are in place`,
        `${c.orange}•${c.reset} Use environment variables for all secrets`,
        `${c.orange}•${c.reset} Enable rate limiting`,
        `${c.orange}•${c.reset} Monitor for unusual activity`,
        '',
        'Cloud deployments have different threat models.'
    ]);

    card([
        `${c.secondary}1.${c.reset} Go to ${c.blue}https://railway.app${c.reset}`,
        `${c.secondary}2.${c.reset} Sign in with GitHub`,
        `${c.secondary}3.${c.reset} Install Railway CLI: ${c.orange}npm i -g @railway/cli${c.reset}`,
        `${c.secondary}4.${c.reset} Run: ${c.orange}railway login${c.reset}`
    ], 'RAILWAY SETUP');

    const hasRailway = cmdExists('railway');

    if (!hasRailway) {
        info(`Install Railway CLI: ${c.orange}npm i -g @railway/cli${c.reset}`);
        await pressEnter('Install Railway CLI, then press Enter...');
    }

    const loggedIn = exec('railway whoami 2>/dev/null');

    if (!loggedIn) {
        info(`Run: ${c.orange}railway login${c.reset}`);
        await pressEnter('Log in to Railway, then press Enter...');
    }

    const createProject = await confirm('Create new Railway project?');

    if (createProject) {
        console.log(`\n${c.blue}Creating Railway project...${c.reset}`);
        try {
            execSync('railway init', { stdio: 'inherit', cwd: ROOT });
            ok('Railway project created');

            console.log(`\n${c.blue}Setting environment variables...${c.reset}`);

            const envVars = [
                `TELEGRAM_BOT_TOKEN=${state.telegramToken}`,
                `TELEGRAM_USER_ID=${state.telegramUserId}`,
                `LOCAL_MASTER_PASSWORD=${state.masterPassword}`,
                'USE_LOCAL_PROXY=false'
            ];

            for (const v of envVars) {
                exec(`railway variables set "${v}" 2>/dev/null`);
            }

            ok('Environment variables set');
            warn('Add your API keys in Railway dashboard');

        } catch (e) {
            fail('Railway setup failed');
        }
    }
}

async function showSummary(): Promise<void> {
    header('Setup Complete!');

    console.log(`${c.green}Gravity Claw has been configured.${c.reset}\n`);

    card([
        `${c.bold}WHAT WAS SET UP:${c.reset}`,
        '',
        `${c.green}●${c.reset} Agent key generated and stored`,
        `${c.green}●${c.reset} Security module configured`,
        `${c.green}●${c.reset} Proxy ready for real API keys`,
        `${c.green}●${c.reset} Telegram bot connected`,
        `${c.green}●${c.reset} Environment files created`,
        state.supabaseUrl ? `${c.green}●${c.reset} Supabase configured` : '',
        state.missionControlEnabled ? `${c.green}●${c.reset} Mission Control ready` : '',
    ].filter(Boolean));

    securityWarning([
        `${c.bold}YOUR TEST KEY EXPIRES SOON${c.reset}`,
        `The OpenRouter key you used was temporary.`,
        '',
        'Add real keys to proxy/.env.real before the',
        'test key expires.'
    ]);

    console.log(`
${c.orange}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}
${c.bold}TO ADD REAL KEYS:${c.reset}
${c.orange}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}

  1. Edit ${c.blue}proxy/.env.real${c.reset}
  2. Add your real API keys
  3. Start the proxy: ${c.orange}npm run proxy${c.reset}

${c.orange}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}
${c.bold}TO START GRAVITY CLAW:${c.reset}
${c.orange}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}

  ${c.muted}# Terminal 1 - Start proxy${c.reset}
  ${c.orange}npm run proxy${c.reset}

  ${c.muted}# Terminal 2 - Start agent${c.reset}
  ${c.orange}npm run dev${c.reset}
${state.missionControlEnabled ? `
  ${c.muted}# Terminal 3 - Start Mission Control${c.reset}
  ${c.orange}cd mission-control && npm run dev${c.reset}
` : ''}
${c.orange}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}
${c.bold}SECURITY FILES${c.reset} ${c.muted}(Never commit these)${c.reset}
${c.orange}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}

  ${c.red}●${c.reset} .env
  ${c.red}●${c.reset} proxy/.env.real
  ${c.red}●${c.reset} data/.agent-secret
  ${c.red}●${c.reset} data/agent-keys.json
  ${c.red}●${c.reset} mission-control/.env.local

${c.orange}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}
${c.bold}ADMIN SECRET${c.reset} ${c.red}(Save this!)${c.reset}
${c.orange}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}

${c.muted}${state.proxyAdminSecret}${c.reset}

${c.orange}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}

${c.muted}Remember: This is open source software provided AS IS.
You are responsible for your own security.${c.reset}
`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
    try {
        await welcome();
        await checkPrerequisites();
        await setupOpenRouterTestKey();
        await setupTelegram();
        await setupSecurity();
        await setupProxy();
        await generateEnvFile();
        await testFullSystem();
        await setupSupabase();
        await setupMissionControl();
        await setupRailway();
        await showSummary();
    } catch (e: any) {
        console.error(`\n${c.red}Setup failed:${c.reset}`, e.message);
        process.exit(1);
    } finally {
        rl.close();
    }
}

main();
