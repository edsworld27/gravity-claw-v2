/**
 * Gravity Claw Setup V3
 *
 * CLI wizard for configuring the agent.
 * Supports two modes:
 *   1. Proxy Mode - Connect to Mission Control proxy (recommended for security)
 *   2. Standalone Mode - Direct API keys (simpler but less secure)
 *
 * Run: npm run setup
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ENV_PATH = path.join(__dirname, '..', '.env');

// ============================================
// Utility Functions
// ============================================

function readEnv(): Record<string, string> {
    const env: Record<string, string> = {};
    if (fs.existsSync(ENV_PATH)) {
        const content = fs.readFileSync(ENV_PATH, 'utf-8');
        for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const [key, ...valueParts] = trimmed.split('=');
                if (key) {
                    env[key.trim()] = valueParts.join('=').trim();
                }
            }
        }
    }
    return env;
}

function writeEnv(updates: Record<string, string>): void {
    let content = '';

    if (fs.existsSync(ENV_PATH)) {
        content = fs.readFileSync(ENV_PATH, 'utf-8');
    }

    for (const [key, value] of Object.entries(updates)) {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (regex.test(content)) {
            content = content.replace(regex, `${key}=${value}`);
        } else {
            content += `\n${key}=${value}`;
        }
    }

    fs.writeFileSync(ENV_PATH, content.trim() + '\n');
}

async function prompt(question: string, defaultValue?: string, hidden?: boolean): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        const q = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
        rl.question(q, (answer) => {
            rl.close();
            resolve(answer.trim() || defaultValue || '');
        });
    });
}

async function confirm(question: string, defaultYes: boolean = true): Promise<boolean> {
    const hint = defaultYes ? '(Y/n)' : '(y/N)';
    const answer = await prompt(`${question} ${hint}`, '');
    if (answer === '') return defaultYes;
    return answer.toLowerCase().startsWith('y');
}

async function testProxyConnection(url: string, agentKey: string): Promise<boolean> {
    try {
        console.log(`\n  Testing connection to ${url}...`);

        const healthResponse = await fetch(`${url}/health`);
        if (!healthResponse.ok) {
            console.log('  ✗ Proxy health check failed');
            return false;
        }
        console.log('  ✓ Proxy is reachable');

        const permResponse = await fetch(`${url}/permissions`, {
            headers: { 'X-Agent-Key': agentKey }
        });

        if (!permResponse.ok) {
            console.log('  ✗ Agent key validation failed');
            return false;
        }
        console.log('  ✓ Agent key accepted');

        const permissions = await permResponse.json();
        console.log(`  ✓ ${permissions.apis?.length || 0} APIs available`);
        console.log(`  ✓ ${permissions.actions?.length || 0} actions allowed`);

        return true;

    } catch (error: any) {
        console.log(`  ✗ Connection failed: ${error.message}`);
        return false;
    }
}

async function testTelegramBot(token: string): Promise<{ ok: boolean; username?: string }> {
    try {
        const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
        const data = await response.json();
        if (data.ok) {
            return { ok: true, username: data.result.username };
        }
        return { ok: false };
    } catch {
        return { ok: false };
    }
}

async function testOpenRouterKey(key: string): Promise<boolean> {
    try {
        const response = await fetch('https://openrouter.ai/api/v1/models', {
            headers: { 'Authorization': `Bearer ${key}` }
        });
        return response.ok;
    } catch {
        return false;
    }
}

// ============================================
// Setup Wizard
// ============================================

async function runSetupWizard(): Promise<void> {
    const env = readEnv();

    console.clear();
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║              GRAVITY CLAW SETUP WIZARD (V3)                  ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('  Welcome! This wizard will help you configure Gravity Claw.');
    console.log('');

    // Step 1: Choose mode
    console.log('  ┌─────────────────────────────────────────────────────────────┐');
    console.log('  │ STEP 1: Choose Setup Mode                                  │');
    console.log('  └─────────────────────────────────────────────────────────────┘');
    console.log('');
    console.log('  1. PROXY MODE (Recommended)');
    console.log('     • API keys stay on your secure machine');
    console.log('     • Connect to Mission Control proxy');
    console.log('     • Best for VPS deployments');
    console.log('');
    console.log('  2. STANDALONE MODE');
    console.log('     • API keys stored locally');
    console.log('     • No proxy needed');
    console.log('     • Simpler but less secure');
    console.log('');

    const modeChoice = await prompt('  Choose mode (1 or 2)', '1');
    const useProxy = modeChoice === '1';

    console.log('');
    console.log(`  Selected: ${useProxy ? 'PROXY MODE' : 'STANDALONE MODE'}`);
    console.log('');

    // Step 2: Telegram Configuration
    console.log('  ┌─────────────────────────────────────────────────────────────┐');
    console.log('  │ STEP 2: Telegram Bot Configuration                         │');
    console.log('  └─────────────────────────────────────────────────────────────┘');
    console.log('');
    console.log('  You need a Telegram bot to communicate with Gravity Claw.');
    console.log('  Create one at: https://t.me/BotFather');
    console.log('');

    let telegramToken = env['TELEGRAM_BOT_TOKEN'] || '';
    let telegramUserId = env['TELEGRAM_USER_ID'] || '';

    // Get and validate Telegram token
    let botUsername = '';
    while (true) {
        telegramToken = await prompt('  Bot Token', telegramToken !== 'your_telegram_bot_token_here' ? telegramToken : '');

        if (!telegramToken) {
            console.log('  ✗ Bot token is required');
            continue;
        }

        console.log('  Testing bot token...');
        const result = await testTelegramBot(telegramToken);
        if (result.ok) {
            botUsername = result.username || '';
            console.log(`  ✓ Bot verified: @${botUsername}`);
            break;
        } else {
            console.log('  ✗ Invalid bot token. Please try again.');
        }
    }

    // Get Telegram user ID
    console.log('');
    console.log('  Your Telegram User ID restricts who can use this bot.');
    console.log('  Get it from: https://t.me/userinfobot');
    console.log('');

    telegramUserId = await prompt('  Your Telegram User ID', telegramUserId !== 'your_telegram_user_id_here' ? telegramUserId : '');

    console.log('');

    // Step 3: Connection Configuration (depends on mode)
    if (useProxy) {
        // PROXY MODE
        console.log('  ┌─────────────────────────────────────────────────────────────┐');
        console.log('  │ STEP 3: Proxy Connection                                   │');
        console.log('  └─────────────────────────────────────────────────────────────┘');
        console.log('');
        console.log('  Connect to your Mission Control proxy.');
        console.log('');
        console.log('  Connection options:');
        console.log('    • http://localhost:4000     - SSH tunnel (recommended)');
        console.log('    • http://100.64.x.x:4000    - Tailscale direct');
        console.log('');

        let proxyUrl = env['PROXY_URL'] || 'http://localhost:4000';
        let agentKey = env['AGENT_KEY'] || '';

        // Get proxy URL and agent key
        while (true) {
            proxyUrl = await prompt('  Proxy URL', proxyUrl);
            agentKey = await prompt('  Agent Key', agentKey !== 'your_agent_key_here' ? agentKey : '');

            if (!agentKey) {
                console.log('  ✗ Agent key is required for proxy mode');
                continue;
            }

            const connected = await testProxyConnection(proxyUrl, agentKey);
            if (connected) {
                break;
            }

            console.log('');
            console.log('  Connection failed. Please check:');
            console.log('    1. Mission Control proxy is running');
            console.log('    2. SSH tunnel is active (if using)');
            console.log('    3. Agent key matches proxy config');
            console.log('');

            if (!await confirm('  Try again?', true)) {
                console.log('  Setup cancelled.');
                process.exit(1);
            }
        }

        // Save proxy mode config
        console.log('');
        console.log('  Saving configuration...');

        writeEnv({
            'USE_LOCAL_PROXY': 'true',
            'PROXY_URL': proxyUrl,
            'AGENT_KEY': agentKey,
            'TELEGRAM_BOT_TOKEN': telegramToken,
            'TELEGRAM_USER_ID': telegramUserId
        });

    } else {
        // STANDALONE MODE
        console.log('  ┌─────────────────────────────────────────────────────────────┐');
        console.log('  │ STEP 3: API Keys                                           │');
        console.log('  └─────────────────────────────────────────────────────────────┘');
        console.log('');
        console.log('  Enter your API keys directly. These will be stored locally.');
        console.log('');

        // OpenRouter key (required)
        let openRouterKey = env['OPENROUTER_API_KEY'] || '';

        while (true) {
            openRouterKey = await prompt('  OpenRouter API Key', openRouterKey.startsWith('gc-placeholder') ? '' : openRouterKey);

            if (!openRouterKey) {
                console.log('  ✗ OpenRouter key is required');
                continue;
            }

            console.log('  Testing OpenRouter key...');
            if (await testOpenRouterKey(openRouterKey)) {
                console.log('  ✓ OpenRouter key valid');
                break;
            } else {
                console.log('  ✗ Invalid OpenRouter key. Please try again.');
            }
        }

        // Model Selection
        console.log('');
        console.log('  ┌─────────────────────────────────────────────────────────────┐');
        console.log('  │ STEP 4: Model Selection                                     │');
        console.log('  └─────────────────────────────────────────────────────────────┘');
        console.log('');
        console.log('  FREE MODELS (no API cost):');
        console.log('    1. google/gemini-2.0-flash-exp:free      (Fast, good quality)');
        console.log('    2. meta-llama/llama-3.3-70b-instruct:free (Large, powerful)');
        console.log('    3. qwen/qwen-2.5-72b-instruct:free        (Chinese + English)');
        console.log('    4. deepseek/deepseek-chat:free            (Good coding)');
        console.log('    5. mistralai/mistral-small-24b-instruct-2501:free');
        console.log('');
        console.log('  Or enter a custom model ID from openrouter.ai/models');
        console.log('');

        const modelChoice = await prompt('  Choose model (1-5 or custom ID)', '1');

        const modelMap: Record<string, string> = {
            '1': 'google/gemini-2.0-flash-exp:free',
            '2': 'meta-llama/llama-3.3-70b-instruct:free',
            '3': 'qwen/qwen-2.5-72b-instruct:free',
            '4': 'deepseek/deepseek-chat:free',
            '5': 'mistralai/mistral-small-24b-instruct-2501:free',
        };

        const selectedModel = modelMap[modelChoice] || modelChoice;
        console.log(`  ✓ Selected: ${selectedModel}`);

        console.log('');
        console.log('  Optional API keys (press Enter to skip):');
        console.log('');

        const anthropicKey = await prompt('  Anthropic API Key (optional)', '');
        const openaiKey = await prompt('  OpenAI API Key (optional)', '');

        // Save standalone mode config
        console.log('');
        console.log('  Saving configuration...');

        const config: Record<string, string> = {
            'USE_LOCAL_PROXY': 'false',
            'TELEGRAM_BOT_TOKEN': telegramToken,
            'TELEGRAM_USER_ID': telegramUserId,
            'OPENROUTER_API_KEY': openRouterKey,
            'DEFAULT_MODEL': selectedModel
        };

        if (anthropicKey) config['ANTHROPIC_API_KEY'] = anthropicKey;
        if (openaiKey) config['OPENAI_API_KEY'] = openaiKey;

        writeEnv(config);
    }

    // Done!
    console.log('  ✓ Configuration saved to .env');
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    SETUP COMPLETE!                           ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('  Configuration Summary:');
    console.log(`    • Mode: ${useProxy ? 'PROXY' : 'STANDALONE'}`);
    console.log(`    • Telegram Bot: @${botUsername}`);
    if (useProxy) {
        console.log(`    • Proxy: ${env['PROXY_URL'] || 'configured'}`);
    }
    console.log('');
    console.log('  Next steps:');
    console.log('    1. Start the agent: npm run dev');
    console.log('    2. Send a message to your bot on Telegram');
    console.log('');
}

// ============================================
// Auto-detect if setup needed
// ============================================

export function isSetupRequired(): boolean {
    const env = readEnv();

    const telegramToken = env['TELEGRAM_BOT_TOKEN'] || '';
    const telegramUserId = env['TELEGRAM_USER_ID'] || '';

    // Missing Telegram config
    if (!telegramToken || telegramToken === 'your_telegram_bot_token_here') {
        return true;
    }
    if (!telegramUserId || telegramUserId === 'your_telegram_user_id_here') {
        return true;
    }

    const useProxy = env['USE_LOCAL_PROXY'] === 'true';

    if (useProxy) {
        // Proxy mode: need agent key
        const agentKey = env['AGENT_KEY'] || '';
        if (!agentKey || agentKey === 'your_agent_key_here') {
            return true;
        }
    } else {
        // Standalone mode: need OpenRouter key
        const openRouterKey = env['OPENROUTER_API_KEY'] || '';
        if (!openRouterKey || openRouterKey.startsWith('gc-placeholder')) {
            return true;
        }
    }

    return false;
}

export async function runFirstTimeSetup(): Promise<boolean> {
    await runSetupWizard();
    return true;
}

// ============================================
// CLI Entry Point
// ============================================

// If run directly: npm run setup
const isDirectRun = process.argv[1]?.includes('setup');
if (isDirectRun) {
    runSetupWizard().catch(console.error);
}
