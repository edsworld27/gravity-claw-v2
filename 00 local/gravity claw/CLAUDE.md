# Claude Instructions for Gravity Claw

## When User Says "setup"

Install dependencies and launch Mission Control (which IS the setup wizard):

```bash
npm install && cd mission-control && npm install && npm run dev
```

Then tell the user to open http://localhost:3000 - Mission Control will automatically show the setup wizard if setup hasn't been completed.

## When User Says "start" or "run"

```bash
# Need three terminals:
npm run proxy       # Terminal 1 - Secure proxy
npm run dev         # Terminal 2 - Main agent
npm run dashboard   # Terminal 3 - Mission Control
```

Or use a process manager to run all three.

## When User Says "verify" or "check"

```bash
npm run verify
```

## When User Says "generate key" or "new agent key"

```bash
npm run generate-key "agent-name"
```

## Project Structure

```
gravity-claw/
├── src/              # Main agent code
│   ├── security/     # Agent keys, XML prompts, zero-trust
│   ├── channels/     # Telegram, Discord, Slack, etc.
│   ├── tools/        # Agent capabilities
│   └── providers/    # LLM provider integrations
├── proxy/            # Secure API key proxy
├── mission-control/  # Dashboard & Setup Wizard (Next.js)
├── scripts/          # CLI tools
└── data/             # Runtime data (gitignored)
```

## Key Concepts

- **Agent Keys** - Every component has a `gc-agent-xxx` key
- **Secure Proxy** - Real API keys only in `proxy/.env.real`
- **XML Boundaries** - User input wrapped in `<untrusted_user_data>`
- **Mission Control** - Setup wizard + monitoring dashboard

## Security Notes

- Never commit `.env`, `proxy/.env.real`, `data/*`, `mission-control/.env.local`
- Real API keys only go in `proxy/.env.real`
- Agent code only sees placeholder keys
- All requests without valid agent keys are rejected
