import dotenv from 'dotenv';
dotenv.config();

const requiredEnvVars = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_USER_ID', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'ELEVENLABS_API_KEY'];

export const config = {
    masterKey: process.env.MASTER_KEY || '', // 32-byte hex string
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN as string,
    telegramUserId: Number(process.env.TELEGRAM_USER_ID),
    anthropicApiKey: process.env.ANTHROPIC_API_KEY as string,
    openaiApiKey: process.env.OPENAI_API_KEY as string,
    elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || '',
    elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM',

    // Omni Channel Optional Keys
    discordBotToken: process.env.DISCORD_BOT_TOKEN || '',
    slackBotToken: process.env.SLACK_BOT_TOKEN || '',
    slackSigningSecret: process.env.SLACK_SIGNING_SECRET || '',
    slackAppToken: process.env.SLACK_APP_TOKEN || '',
    teamsBotId: process.env.TEAMS_BOT_ID || '',
    teamsBotPassword: process.env.TEAMS_BOT_PASSWORD || '',
    signalNumber: process.env.SIGNAL_NUMBER || '',
    gmailClientId: process.env.GMAIL_CLIENT_ID || '',
    gmailClientSecret: process.env.GMAIL_CLIENT_SECRET || '',
    gmailRedirectUri: process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/oauth2callback',
    bluebubblesServerUrl: process.env.BLUEBUBBLES_SERVER_URL || '',
    bluebubblesPassword: process.env.BLUEBUBBLES_PASSWORD || '',
    spotifyClientId: process.env.SPOTIFY_CLIENT_ID || '',
    spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
    calendarClientId: process.env.GOOGLE_CALENDAR_CLIENT_ID || '',
    calendarClientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET || '',
    openWeatherApiKey: process.env.OPENWEATHER_API_KEY || '',
    newsApiKey: process.env.NEWS_API_KEY || '',
    haUrl: process.env.HOME_ASSISTANT_URL || '',
    haToken: process.env.HOME_ASSISTANT_TOKEN || '',

    // Supabase + pgvector (Feature 23)
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || '',

    // Model Expansion
    openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
    ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
    braveSearchApiKey: process.env.BRAVE_SEARCH_API_KEY || '',

    // Model Selection
    defaultModel: process.env.DEFAULT_MODEL || 'google/gemini-2.0-flash-exp:free',

    // Free models on OpenRouter (no API cost)
    freeModels: [
        'google/gemini-2.0-flash-exp:free',
        'google/gemini-exp-1206:free',
        'meta-llama/llama-3.3-70b-instruct:free',
        'qwen/qwen-2.5-72b-instruct:free',
        'deepseek/deepseek-chat:free',
        'mistralai/mistral-small-24b-instruct-2501:free',
    ],

    // Premium models (for complex tasks)
    premiumModel: process.env.PREMIUM_MODEL || 'anthropic/claude-sonnet-4',

    // Rate Limiting
    rateLimits: {
        apiCallDelayMs: 5000,      // 5s between API calls
        searchDelayMs: 10000,      // 10s between searches
        maxSearchesPerBatch: 5,    // Then 2min pause
        batchPauseMs: 120000,      // 2 minute pause
    },

    // Budget Controls
    budget: {
        dailyLimit: Number(process.env.DAILY_BUDGET) || 5,    // $5/day
        monthlyLimit: Number(process.env.MONTHLY_BUDGET) || 50, // $50/month
        warningThreshold: 0.75,    // Warn at 75%
    },

    // Security (Feature 44)
    airGappedMode: process.env.AIR_GAPPED_MODE === 'true',
    externalTools: new Set(['google_search', 'scrape_page', 'news_search', 'news_get_top', 'weather_get', 'deep_research', 'gmail_send', 'gmail_read', 'gmail_list', 'spotify_search_play'])
};
