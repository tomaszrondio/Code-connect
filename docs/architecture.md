# Architecture

## Overview

Node.js bot (grammY) manages a `claude` CLI process via `node-pty` pseudo-terminal. First Telegram message spawns `claude --continue` in the project directory as a persistent PTY process. Subsequent messages are written to stdin. Output (stripped of ANSI) streams to Telegram via `editMessageText`. `/close` kills the process. Custom commands from `.claude/commands/` are exposed as inline keyboards.

## Tech Stack

| Component       | Tool                                | Why                                                                        |
|-----------------|-------------------------------------|----------------------------------------------------------------------------|
| Telegram bot    | grammY                              | TS-first, middleware, auto-retry plugin, inline keyboards                  |
| Spawn CLI       | node-pty                            | PTY = Claude Code thinks it's in a terminal, doesn't switch to batch mode  |
| ANSI strip      | `node:util` stripVTControlCharacters| Built into Node 16+, zero dependencies                                    |
| Process manager | PM2                                 | Auto-restart, logs, startup script                                         |
| Runtime         | Node.js 20+                         | LTS, native TS (tsx), node:util                                            |

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  VPS                                                            │
│                                                                 │
│  ┌──────────────┐         ┌──────────────┐                      │
│  │  grammY Bot   │────────▶│ SessionMgr   │                      │
│  │  (long poll)  │◀────────│              │                      │
│  └──────┬───────┘         └──────┬───────┘                      │
│         │                        │                               │
│    Auth middleware          spawn / write / kill                  │
│    (whitelist userIDs)           │                               │
│         │                 ┌──────▼───────┐                      │
│         │                 │  node-pty     │                      │
│         │                 │  claude       │                      │
│         │                 │  --continue   │                      │
│         │                 │  cwd: /proj   │                      │
│         │                 └──────┬───────┘                      │
│         │                        │                               │
│         │              onData (raw ANSI)                         │
│         │                        │                               │
│         │                 ┌──────▼───────┐                      │
│         │                 │ OutputParser  │                      │
│         │                 │ strip ANSI    │                      │
│         │                 │ debounce      │                      │
│         │                 │ detect idle   │                      │
│         │                 └──────┬───────┘                      │
│         │                        │                               │
│         ◀────── editMessageText ─┘                               │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  PM2 — auto-restart, log rotation                           ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## File Structure

```
claude-tg-bridge/
├── src/
│   ├── index.ts              # Entry: bot setup, middleware, start polling
│   ├── config.ts             # Env vars, constants
│   ├── auth.ts               # Middleware: whitelist user IDs
│   ├── session.ts            # SessionManager: spawn/write/kill node-pty
│   ├── output-parser.ts      # Strip ANSI, buffering, idle detection
│   ├── telegram-stream.ts    # editMessageText with debounce + split
│   ├── commands/
│   │   ├── registry.ts       # Scan .claude/commands/, register in TG
│   │   ├── handlers.ts       # /start /close /status /compact /model /cost /menu /help
│   │   └── keyboards.ts      # InlineKeyboard builders
│   └── types.ts              # Interfaces
├── docs/                     # Documentation
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── ecosystem.config.cjs      # PM2
```

## Key Modules

### SessionManager (`session.ts`)

Core of the bridge. Manages Claude CLI process lifecycle.

- **`spawn(chatId)`** — creates PTY with `claude --continue`, cwd=PROJECT_DIR
- **`write(chatId, text)`** — sends `text + '\r'` to PTY stdin; queues if busy
- **`sendCommand(chatId, cmd)`** — alias for write (slash commands)
- **`close(chatId)`** — sends `/exit\r` then kills after 3s
- **`markIdle(chatId)`** — processes message queue after idle timeout
- **Events:** `data`, `exit`, `ready`, `idle`, `timeout`

Key decisions:
- `claude --continue` automatically resumes the last session in the project directory
- `\r` (carriage return) not `\n` — PTY requires CR like a real terminal
- Busy flag + queue — Claude Code can't handle concurrent input
- Idle timer (2s default) detects when Claude finishes responding
- Session timer (30min default) auto-kills inactive sessions

### OutputParser (`output-parser.ts`)

Cleans raw PTY output for Telegram display.

- `stripVTControlCharacters` from `node:util` handles ANSI escape codes
- Filters spinner characters, status lines, box-drawing characters
- Input echo filtering — PTY echoes back what user typed
- Per-chat buffer accumulation with dedup detection

### TelegramStreamer (`telegram-stream.ts`)

Streams Claude's response to Telegram in real-time.

- Sends placeholder message on user input
- Debounced `editMessageText` updates (800ms default)
- Cursor indicator (`▌`) during streaming
- Splits messages >4096 chars at natural boundaries
- Optional forwarding to group chat

## Group Chat Support

```
DM (private chat):
  → Every message goes to Claude
  → Response comes back to DM
  → (optional) Forward to GROUP_CHAT_ID

Group:
  → Bot responds ONLY to:
    1. Reply to bot's message
    2. @mention of the bot
    3. Commands /cmd@botusername
  → Separate Claude session per chat (DM ≠ group)
```

Privacy mode (enabled by default in BotFather): bot in a group only sees commands and replies to itself. To see all messages → disable privacy mode in BotFather (`/setprivacy` → Disabled).
