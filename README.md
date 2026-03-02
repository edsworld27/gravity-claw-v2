# Gravity Claw V2

A secure, personal AI agent with zero-trust architecture and XML prompt injection defense.

## Repository Structure

This repository contains the core Gravity Claw agent:
- `00 local/gravity claw/`: The main agent source code, setup scripts, and local data.

## Installation & Setup

### 1. Requirements
- Node.js (Latest LTS recommended)
- Docker (for secure sandboxed tools)
- Tailscale (optional, for secure mesh networking)

### 2. Clone & Install
```bash
git clone https://github.com/edsworld27/gravity-claw-v2.git
cd gravity-claw-v2/"00 local/gravity claw"
npm install
```

### 3. Interactive Setup
Run the setup wizard to configure your agent, security keys, and proxy connections:
```bash
npm run setup
```

### 4. Running the Agent
```bash
# Start the security proxy (required for API access)
npm run proxy

# Start the agent core
npm run dev
```

## Security Note
This agent uses a **Zero-Trust Architecture**. Your real API keys are stored securely in a vault and accessed through a proxy. The agent itself only handles encrypted "Agent Keys" (`gc-agent-xxx`).

## License
MIT
