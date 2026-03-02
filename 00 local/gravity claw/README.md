# Gravity Claw

A secure, personal AI agent with zero-trust architecture and XML prompt injection defense.

## Quick Start

### 1. Open Antigravity (Sandboxed Environment)

Launch your Antigravity sandbox - this keeps everything isolated and secure.

### 2. Clone & Install

```bash
git clone https://github.com/yourusername/gravity-claw.git
cd gravity-claw
npm install
```

### 3. Run Setup

```bash
npm run setup
```

The interactive wizard walks you through:
1. Tailscale & Docker checks
2. Temp OpenRouter key (30 min, £5 limit)
3. Telegram bot setup
4. Security key generation
5. Supabase connection (optional)
6. Mission Control setup (optional)

**You never enter permanent API keys.** Test keys expire, real keys go through the secure proxy.

### Dev Mode (Skip Setup)

For development/testing, bypass setup entirely:

```bash
npm run dev:skip-setup
```

This launches Mission Control in **Sandbox Mode**:
- **Port:** `http://localhost:3001`
- **Key:** `sandbox_key`
- API calls disabled (UI testing only)

---

## After Setup

```bash
npm run proxy       # Terminal 1 - Secure proxy (port 4000)
npm run dev         # Terminal 2 - Agent
npm run dashboard   # Terminal 3 - Mission Control (port 3001)
```

---

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   You           │────▶│  Telegram/      │────▶│  Gravity Claw   │
│   (Human)       │     │  Discord/etc    │     │  Agent          │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
                                                ┌─────────────────┐
                                                │  Secure Proxy   │
                                                │  (Agent Keys)   │
                                                └────────┬────────┘
                                                         │
                        ┌────────────────────────────────┼────────────────────────────────┐
                        ▼                                ▼                                ▼
                ┌──────────────┐                ┌──────────────┐                ┌──────────────┐
                │  Anthropic   │                │   OpenAI     │                │  OpenRouter  │
                └──────────────┘                └──────────────┘                └──────────────┘
```

## Security

- **Agent Keys** - Cryptographic `gc-agent-xxx` identifiers
- **XML Boundaries** - User input structurally separated
- **Secure Proxy** - Real keys never touch agent code
- **Zero Trust** - No key = rejected

## Never Commit

```
.env
proxy/.env.real
data/
mission-control/.env.local
```

## License

MIT
