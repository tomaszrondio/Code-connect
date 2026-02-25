# Commands & Keyboards

## Bot Commands

| Command | Description | Requires active session |
|---------|-------------|------------------------|
| `/start` | Welcome message + main menu keyboard | No |
| `/menu` | Show command panel (inline keyboard) | No |
| `/close` | Close Claude Code session | Yes |
| `/status` | Show session status (active/inactive) | No |
| `/compact` | Compress session context (passthrough) | Yes |
| `/clear` | Clear session history (passthrough) | Yes |
| `/cost` | Show token usage (passthrough) | Yes |
| `/model` | Change model (passthrough) | Yes |
| `/memory` | Show/edit CLAUDE.md (passthrough) | Yes |
| `/commands` | List custom commands from `.claude/commands/` | No |

"Passthrough" commands are sent directly to the Claude Code CLI as slash commands.

## Inline Keyboards

### Main Menu

Shown via `/menu` or `/start`:

```
[ Continue session ] [ Clear          ]
[ Compact          ] [ Cost           ]
[ Model            ] [ Memory         ]
[ Custom commands  ] [ Close session  ]
```

### Model Picker

Shown when clicking "Model" in main menu:

```
[ Sonnet ]
[ Opus   ]
[ Haiku  ]
[ << Menu ]
```

### Custom Commands

Shown when clicking "Custom commands" or using `/commands`. Dynamically built from `.claude/commands/*.md` files in the project directory.

## Custom Commands

Custom commands are `.md` files in `.claude/commands/` within the `PROJECT_DIR`:

```
.claude/commands/
├── review.md          → /project:review
├── test.md            → /project:test
├── deploy-check.md    → /project:deploy-check
└── fix-lint.md        → /project:fix-lint
```

### Ways to invoke from Telegram

1. **Inline keyboard:** `/commands` → click button → bot sends `/project:review` to PTY
2. **Text:** user types `/project:review` → bot matches regex → passthrough to PTY
3. **Menu:** `/menu` → "Custom commands" → inline keyboard picker

### How it works

Commands `/project:name` work natively in Claude Code interactive mode — Claude reads `.claude/commands/name.md` and executes the instructions. The bridge does a 1:1 passthrough, no mapping needed.

## Message Flow

### Plain text message

1. User sends text in Telegram
2. Auth middleware checks user ID whitelist
3. If no session exists → spawn `claude --continue` PTY process
4. Bot sends placeholder message ("...")
5. User text written to PTY stdin
6. PTY output → ANSI strip → noise filter → debounced `editMessageText`
7. After idle timeout (2s silence) → final message edit

### Slash command

1. User sends `/compact` (or clicks keyboard button)
2. Bot sends `/compact` to PTY stdin
3. Claude Code processes the command
4. Output streams back the same way as plain text

### Group chat

Bot responds only when:
- Message is a reply to bot's message
- Message contains @botusername mention
- Message is a /command

Each group chat has its own separate Claude session.
