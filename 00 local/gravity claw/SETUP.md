# Gravity Claw - Universal Setup Guide

You have requested a massive 65-feature AI agent. To build this seamlessly without blocking on authentication, I have prepared this setup guide.

**How this works:**
1. I will build all the features using the environment variables listed below.
2. If a variable is missing at runtime, that specific feature will simply stay dormant (it won't crash the bot).
3. You can gather these keys at your own pace. Once you drop them into your `.env` file and restart the bot, the features will instantly come alive.

---

## Step 1: The `.env` File
Copy `.env.example` to `.env`. Here are the keys you will eventually need to fill out for the various integrations:

### Core Identity & AI Routing
- `ANTHROPIC_API_KEY`: Your Claude API key.
- `OPENROUTER_API_KEY`: Your OpenRouter API key (for hot-swapping to Mistral, Llama, etc.).
- `OPENAI_API_KEY`: Your OpenAI API key (for Whisper audio transcription and fallback text generation).
- `GROQ_API_KEY` / `DEEPSEEK_API_KEY`: Keys for alternative LLM fallbacks.
- `LOCAL_MASTER_PASSWORD`: A secure password of your choosing, used to encrypt any internal API keys or secrets written to the local disk.

### Supported Messaging Channels
- **Telegram**: `TELEGRAM_BOT_TOKEN` & `TELEGRAM_USER_ID` (Whitelist).
- **Discord**: `DISCORD_BOT_TOKEN` (From Discord Developer Portal).
- **Slack**: `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_APP_TOKEN` (From Slack API dashboard).
- **Microsoft Teams**: `TEAMS_BOT_ID`, `TEAMS_BOT_PASSWORD`.
- **iMessage (BlueBubbles)**: `BLUEBUBBLES_SERVER_URL`, `BLUEBUBBLES_PASSWORD`.
- **WhatsApp**: *(No API Key needed. You will scan a QR code in the terminal on first boot).*
- **Signal**: `SIGNAL_NUMBER` (e.g. `+1234567890`). Install `signal-cli` via Homebrew (`brew install signal-cli`). Register/link your account manually first.

### Voice & Perception
- **ElevenLabs**: `ELEVENLABS_API_KEY` & `ELEVENLABS_VOICE_ID` (For ultra-realistic TTS).

### Advanced Tools & Search
- **Google Web Search**: `GOOGLE_API_KEY` & `GOOGLE_SEARCH_ENGINE_ID` (For the Google Custom Search JSON API).
- **Gmail API**: `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REDIRECT_URI` (Google Cloud Console OAuth 2.0 credentials).

### Cloud Memory Backend (Optional alternative to local SQLite)
- **Supabase (pgvector)**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

---

## 🛡️ Zero-Trust Credential Proxy (Important)

Gravity Claw implements a zero-trust credential system. The main Agent Node.js process does **not** need your real Anthropic or OpenAI API keys in its `.env` file. 

Instead, you can use the secure proxy:
1. Open the **Mission Control Dashboard**, navigate to **Settings**, and paste your real keys in the **Zero-Trust Provider Credentials** section.
2. The dashboard securely writes these keys to `proxy/.env.real`.
3. Start the proxy server in a separate terminal:
   ```bash
   cd proxy
   npm run start
   ```
4. Start the main Gravity Claw agent with the local proxy enabled:
   ```bash
   USE_LOCAL_PROXY=true npm run start
   ```
5. The agent will intercept requests, route them to `http://localhost:4000`, and the proxy will securely inject your real keys before sending them to the provider.

---

## Step 2: Local Dependencies (Instructions for Later)

While writing the code, I will use libraries that sometimes require system-level tools to be installed on your Mac. You won't need to do this until you want to actually use the specific feature:

1. **Local LLMs (Ollama)**: If you want fully offline, air-gapped LLM processing, you will need to download and install [Ollama](https://ollama.com/) on your Mac, and run `ollama pull llama3` in your terminal.
2. **Browser Automation**: The code will use Puppeteer/Playwright. On first run, it might download a bundled version of Chromium automatically.
3. **Signal Integration**: Depending on how we bridge it, you may need to install `signal-cli` via Homebrew (`brew install signal-cli`). I will handle the code that talks to it.

---

**You do NOT need to get these right now!** I will proceed with building the massive architecture. Just keep this file handy for when you're ready to test the specific channels and tools!
