# Documented API Endpoints (INTERFACES.md)

This document lists every external API contract and endpoint used by Gravity Claw. All outbound connections should be monitored and approved against this list to ensure security and compliance.

## AI & LLM Providers

### OpenAI
- **Endpoint**: `https://api.openai.com/v1` (Implicit via SDK)
- **Auth**: Bearer Token (`OPENAI_API_KEY`)
- **Purpose**: Core reasoning, natural language processing.
- **Notes**: May be routed through a local proxy (`http://localhost:4000/v1`) if `USE_LOCAL_PROXY=true`.

### Anthropic
- **Endpoint**: `https://api.anthropic.com/v1` (Implicit via SDK)
- **Auth**: `x-api-key` (`ANTHROPIC_API_KEY`)
- **Purpose**: Core reasoning, natural language processing using Claude models.
- **Notes**: May be routed through a local proxy (`http://localhost:4000`) if `USE_LOCAL_PROXY=true`.

### OpenRouter
- **Endpoint**: `https://openrouter.ai/api/v1`
- **Auth**: Bearer Token (`OPENROUTER_API_KEY`)
- **Purpose**: Access to a variety of third-party LLMs via a unified API.

### Ollama (Local)
- **Endpoint**: `http://localhost:11434/api/chat` (configurable)
- **Auth**: None (typically local)
- **Purpose**: Local, private LLM inference.

### ElevenLabs
- **Endpoint**: `https://api.elevenlabs.io/v1/text-to-speech/{voice_id}`
- **Auth**: `xi-api-key` (`ELEVENLABS_API_KEY`)
- **Purpose**: High-quality Text-to-Speech generation.

## Communication Channels

### Discord
- **Endpoint**: `https://discord.com/api` (Implicit via `discord.js`)
- **Auth**: Bot Token (`DISCORD_TOKEN`)
- **Purpose**: Sending and receiving messages on Discord.

### Slack
- **Endpoint**: `https://slack.com/api` (Implicit via `@slack/bolt`)
- **Auth**: Bot Token (`SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`)
- **Purpose**: Slack integration and messaging.

### WhatsApp (Baileys)
- **Endpoint**: WhatsApp Web WebSockets (Implicit via `@whiskeysockets/baileys`)
- **Auth**: QR Code/Session Data
- **Purpose**: Sending and receiving WhatsApp messages.

### Telegram
- **Endpoint**: `https://api.telegram.org` (Implicit via `grammy`)
- **Auth**: Bot Token (`TELEGRAM_BOT_TOKEN`)
- **Purpose**: Telegram bot communication.

### Google Services (Gmail & Calendar)
- **Endpoint**: `https://www.googleapis.com/` (Implicit via `googleapis`)
- **Auth**: OAuth2 (Client ID, Secret, Refresh Token)
- **Purpose**: Reading/sending emails via Gmail API (`v1`), managing events via Calendar API (`v3`).

## Tools & Utilities

### OpenWeatherMap
- **Endpoint**: `https://api.openweathermap.org/data/2.5/weather`
- **Auth**: Query parameter `appid` (`OPENWEATHER_API_KEY`)
- **Purpose**: Fetching current weather conditions for specific cities.

### NewsAPI
- **Endpoint**: `https://newsapi.org/v2/top-headlines`, `https://newsapi.org/v2/everything`
- **Auth**: Query parameter `apiKey` (`NEWS_API_KEY`)
- **Purpose**: Retrieving top headlines and searching for news articles.

### Spotify
- **Endpoint**: `https://api.spotify.com/v1` (Implicit via `spotify-web-api-node`)
- **Auth**: OAuth2 (Client ID, Secret, Access Token)
- **Purpose**: Searching for tracks, playing, pausing, and getting current playback state.

### Home Assistant
- **Endpoint**: `{HA_URL}/api/states`, `{HA_URL}/api/services/{domain}/{action}`
- **Auth**: Bearer Token (`HA_TOKEN`)
- **Purpose**: Listing entities and controlling smart home devices.

### Supabase
- **Endpoint**: `{SUPABASE_URL}` (Implicit via `@supabase/supabase-js`)
- **Auth**: `apikey` / Bearer (`SUPABASE_KEY`)
- **Purpose**: Database operations and persistent storage functionality.
