FROM node:22-slim

WORKDIR /app

# Install dependencies (may need build tools for better-sqlite3 depending on architecture)
COPY package*.json ./
RUN npm ci

COPY . .

# Run the typescript app directly using tsx 
CMD ["npx", "tsx", "src/index.ts"]
