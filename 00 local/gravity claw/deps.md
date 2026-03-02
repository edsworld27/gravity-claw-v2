# Approved Dependency List (deps.md)

This document lists all approved third-party packages for the Gravity Claw project. **Standard `npm install` for unlisted packages is strictly forbidden.** 

## Production Dependencies

| Package | Version | Purpose |
|---|---|---|
| `@anthropic-ai/sdk` | `^0.36.0` | Anthropic Claude API client |
| `@modelcontextprotocol/sdk` | `^1.27.1` | MCP protocol implementation |
| `@slack/bolt` | `^4.6.0` | Slack bot framework |
| `@supabase/supabase-js` | `^2.98.0` | Supabase database client |
| `@whiskeysockets/baileys` | `^7.0.0-rc.9` | WhatsApp Web API client |
| `axios` | `^1.13.6` | HTTP client for direct API requests |
| `better-sqlite3` | `^12.6.2` | Fast SQLite3 driver for local storage |
| `body-parser` | `^2.2.2` | Express middleware for parsing request bodies |
| `cheerio` | `^1.2.0` | HTML parsing and manipulation |
| `discord.js` | `^14.25.1` | Discord bot framework |
| `dotenv` | `^16.4.7` | Environment variable management |
| `elevenlabs-node` | `^2.0.3` | ElevenLabs TTS API client |
| `express` | `^5.2.1` | Web server framework for webhooks |
| `form-data` | `^4.0.5` | Multipart form-data creation |
| `googleapis` | `^171.4.0` | Google APIs client (Gmail, Calendar) |
| `grammy` | `^1.34.0` | Telegram bot framework |
| `node-cron` | `^4.2.1` | Task scheduler |
| `openai` | `^6.25.0` | OpenAI and OpenRouter client |
| `pdf-parse` | `^2.4.5` | PDF text extraction |
| `pino` | `^10.3.1` | Fast, low-overhead logger |
| `puppeteer` | `^24.37.5` | Headless Chrome for web scraping |
| `qrcode-terminal` | `^0.12.0` | WhatsApp QR code display in terminal |
| `spotify-web-api-node` | `^5.0.2` | Spotify Web API client |
| `ws` | `^8.19.0` | WebSocket client and server |

## Development Dependencies

| Package | Version | Purpose |
|---|---|---|
| `@types/*` | Various | TypeScript definitions for dependencies |
| `tsx` | `^4.19.2` | TypeScript execution environment |
| `typescript` | `^5.7.3` | TypeScript compiler |

*Note: Any new dependency must be reviewed and added to this list before installation.*
