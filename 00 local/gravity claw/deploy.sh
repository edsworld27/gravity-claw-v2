#!/bin/bash

# Ensure Railway CLI is authenticated before running this script
# Run `railway login --browserless` if you haven't yet!

echo "🚀 Initializing Gravity Claw on Railway..."

# 1. Create the project (you may need to select options interactively)
railway init -n "Gravity Claw"

# 2. Extract and Set Variables
echo "⚙️ Setting Environment Variables..."
export $(grep -v '^#' .env | xargs)

railway variables set TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN
railway variables set TELEGRAM_USER_ID=$TELEGRAM_USER_ID
railway variables set ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY
railway variables set OPENAI_API_KEY=$OPENAI_API_KEY
railway variables set ELEVENLABS_API_KEY=$ELEVENLABS_API_KEY
railway variables set ELEVENLABS_VOICE_ID=$ELEVENLABS_VOICE_ID

# 3. Deploy
echo "☁️ Deploying to Railway production..."
railway up --detach

echo "✅ Deployment initiated! Use 'railway logs --lines 100' to monitor."
