# Setup & Deployment

## Prerequisites

- Node.js 20+ (LTS)
- Build tools for node-pty: `sudo apt install build-essential python3`
- Claude Code CLI: `npm install -g @anthropic-ai/claude-code`
- Claude authentication completed (`claude` command run at least once)

## Quick Start (Development)

```bash
# 1. Clone and install
git clone <repo-url>
cd Code-connect
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your values (see Configuration section below)

# 3. Run
npm start
```

## Configuration (.env)

```env
# Telegram
BOT_TOKEN=123456:ABC-DEF              # From @BotFather
ALLOWED_USERS=111222333,444555666      # Telegram user IDs (comma-separated)
GROUP_CHAT_ID=-1001234567890           # Optional: group chat for forwarding results

# Claude Code
PROJECT_DIR=/home/user/myproject       # Working directory for claude CLI

# PTY settings
PTY_COLS=120                           # Terminal width (affects formatting)
PTY_ROWS=40                            # Terminal height

# Tuning
STREAM_DEBOUNCE_MS=800                 # How often to update TG message (ms)
IDLE_TIMEOUT_MS=2000                   # Silence before marking Claude as done (ms)
SESSION_TIMEOUT_MS=1800000             # 30 min — auto-kill inactive session (ms)
```

### Getting your Telegram user ID

Send a message to `@userinfobot` on Telegram — it will reply with your user ID.

### Creating a Telegram bot

1. Open `@BotFather` on Telegram
2. Send `/newbot`
3. Follow the prompts to set name and username
4. Copy the bot token to `BOT_TOKEN` in `.env`

## VPS Deployment (Ubuntu)

```bash
# 1. System dependencies
sudo apt update && sudo apt install -y build-essential python3 curl

# 2. Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Claude Code CLI
npm install -g @anthropic-ai/claude-code

# 4. Authenticate Claude (subscription)
cd /home/user/myproject
claude  # → complete auth flow in browser → Ctrl+C after login

# 5. PM2
npm install -g pm2

# 6. Project setup
cd /opt
git clone <repo-url> claude-tg-bridge
cd claude-tg-bridge
npm install
cp .env.example .env  # fill in values
npm run build

# 7. Start with PM2
pm2 start ecosystem.config.cjs
pm2 startup    # enable auto-start on boot
pm2 save       # save current process list

# 8. Check logs
pm2 logs claude-tg-bridge
```

## PM2 Configuration

The `ecosystem.config.cjs` file configures PM2:

- Single instance (node-pty is not thread-safe — no cluster mode)
- Auto-restart on crash
- 500MB memory limit
- Log files in `./logs/`

### Useful PM2 commands

```bash
pm2 status                    # Check process status
pm2 logs claude-tg-bridge     # View logs
pm2 restart claude-tg-bridge  # Restart
pm2 stop claude-tg-bridge     # Stop
pm2 delete claude-tg-bridge   # Remove from PM2
```

## Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `npm start` | `tsx src/index.ts` | Development (TypeScript directly) |
| `npm run build` | `tsc` | Compile to JavaScript |
| `npm run start:prod` | `node dist/index.js` | Production (compiled) |
