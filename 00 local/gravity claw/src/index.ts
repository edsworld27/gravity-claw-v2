import { bot } from './bot.js';
import { toolRegistry } from './tools/index.js';
import { startHeartbeat } from './heartbeat.js';
import { startWhatsApp } from './channels/whatsapp.js';
import { startDiscord } from './channels/discord.js';
import { startSlack } from './channels/slack.js';
import { startSignal } from './channels/signal.js';
import { gmailService } from './channels/gmail.js';
import { calendarService } from './channels/calendar.js';
import { startBlueBubbles, startTeams, startWebhookServer } from './channels/webhooks.js';
import { hardwareBridge } from './channels/hardware.js';
import { initializeAgentKey } from './agent.js';
import { agentKeyRegistry } from './security/index.js';
import { missionControl } from './services/mission-control.js';
import { runFirstTimeSetup, isSetupRequired } from './setup.js';

console.log('Starting Gravity Claw Level 5...');

// Check if first-time setup is needed
if (isSetupRequired()) {
    console.log('');
    console.log('[Setup] Proxy configuration required...');
    const setupSuccess = await runFirstTimeSetup();
    if (!setupSuccess) {
        console.log('[Setup] Setup cancelled or failed. Exiting.');
        process.exit(1);
    }
}

// Verify proxy connection
const proxyHealthy = await missionControl.checkProxyHealth();
if (process.env.USE_LOCAL_PROXY === 'true' && !proxyHealthy) {
    console.log('');
    console.log('[Warning] Cannot reach proxy at', process.env.PROXY_URL);
    console.log('[Warning] Make sure the proxy is running and accessible.');
    console.log('[Warning] Starting anyway - API calls may fail.');
    console.log('');
}

console.log('');
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║          GRAVITY CLAW SECURITY SYSTEM INITIALIZING           ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

// Initialize the agent key for this instance
const agentKey = initializeAgentKey('gravity-claw-main');
console.log(`[Security] Agent authenticated: ${agentKey.name}`);
console.log(`[Security] Agent key: ${agentKey.keyId.substring(0, 30)}...`);
console.log(`[Security] Permissions: Tools=${agentKey.permissions.canExecuteTools}, Memory=${agentKey.permissions.canAccessMemory}`);
console.log(`[Security] Active agent keys in system: ${agentKeyRegistry.getActiveKeys().length}`);
console.log('');

// Sync User Context (Peephole)
if (process.env.USE_LOCAL_PROXY === 'true') {
    console.log('[MissionControl] Synchronizing user context...');
    const context = await missionControl.getUserContext();
    if (context) {
        const brainCount = context.brain?.length || 0;
        const streak = context.productivity?.streak || 0;
        console.log(`[MissionControl] Context synchronized: ${brainCount} memories, Level ${context.productivity?.level || 1}, Streak ${streak}`);
    } else {
        console.log('[MissionControl] Context sync skipped (no proxy connection)');
    }
    console.log('');
}

// Setup MCP connections before starting the bot
await toolRegistry.initialize();

// Setup error handling for the bot
bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`Error while handling update ${ctx.update.update_id}:`);
    const e = err.error;
    console.error(e);
});

// Start the bot with long-polling
bot.start({
    onStart: async (botInfo) => {
        console.log(`[Telegram] Gravity Claw is online! Logged in as @${botInfo.username}`);

        // Notify Mission Control that agent is online (direct database write)
        await missionControl.logStartup();

        // Start Cron scheduler
        startHeartbeat(bot);

        // Start Dual-Channel WhatsApp Listener
        startWhatsApp().catch(err => console.error('[WhatsApp] Fast-Fail Initialization:', err));

        // Start Discord
        startDiscord().catch(err => console.error('[Discord] Fast-Fail Initialization:', err));

        // Start Slack
        startSlack().catch(err => console.error('[Slack] Fast-Fail Initialization:', err));

        // Start Signal
        startSignal().catch(err => console.error('[Signal] Fast-Fail Initialization:', err));

        // Initialize Gmail
        gmailService.initialize().catch(err => console.error('[Gmail] Fast-Fail Initialization:', err));

        // Start Webhooks for Teams & BlueBubbles
        startBlueBubbles().catch(err => console.error('[iMessage] Fast-Fail Initialization:', err));
        startTeams().catch(err => console.error('[Teams] Fast-Fail Initialization:', err));
        startWebhookServer(3001);
    }
});

// Graceful shutdown
process.once('SIGINT', async () => {
    await missionControl.logShutdown();
    bot.stop();
});
process.once('SIGTERM', async () => {
    await missionControl.logShutdown();
    bot.stop();
});
