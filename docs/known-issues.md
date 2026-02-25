# Known Issues & Tuning

## PTY Output Parsing

Claude Code uses a React+Ink TUI, so raw output contains:
- ANSI escape codes (colors, cursor positioning)
- Spinner animations (braille characters: `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`)
- Full screen redraws
- Echo of typed text (PTY line discipline)

`OutputParser.filterNoise()` is a heuristic — **it will need iterative tuning** with real output.

### Debugging output

Log raw PTY output to a file for analysis. Add to `session.ts`:

```typescript
import { appendFileSync } from 'fs';

proc.onData((data: string) => {
  appendFileSync('/tmp/claude-raw.log', data);
  // ... rest of handler
});
```

Compare raw output with cleaned output to discover new noise patterns and add filters in `filterNoise()`.

## Idle Detection Timeout

The default `IDLE_TIMEOUT_MS=2000` (2 seconds) may be too short or too long:

- **Too short:** When Claude runs tools (e.g., `npm test`) there can be 10+ seconds of silence before results. A 2s timeout would finalize the stream prematurely.
- **Too long:** Delays the "done" signal, making the bot feel slow.

### Recommendations

- Start with 5000ms (5s) for projects that run long shell commands
- For chat-only usage, 2000ms works well
- Consider detecting tool execution patterns in output (lines like "Running: ...") and temporarily increasing timeout

## The `/exit` Bug

Claude Code's `/exit` command sometimes fails to terminate the process. The bridge handles this with a 3-second fallback that force-kills the process.

## Model Picker Interaction

`/model` in Claude Code opens an interactive picker. The bridge sends `/model` followed by the model name after a 1.5s delay. This is a heuristic that may need adjustment.

**Alternative:** Use `claude --model sonnet` as a flag when spawning a new session instead of changing models mid-session.

## Memory Limits

- One Claude process per chat. Each process uses ~100-200MB RAM.
- On a 2GB VPS, don't run more than ~3 concurrent sessions.
- `ALLOWED_USERS` whitelist and `SESSION_TIMEOUT_MS` (30min) help control resource usage.
- PM2 `max_memory_restart: '500M'` provides a safety net.

## Telegram API Limits

- `editMessageText` can fail with "message is not modified" (400) — this is expected and silently caught.
- Telegram rate limit is ~30 messages/second per chat. The 800ms debounce keeps us well below this.
- Maximum message length is 4096 characters. Longer messages are automatically split at natural boundaries (double newline > newline > space).

## Fallback: Stream JSON Mode

If PTY parsing becomes too problematic, there's a fallback approach using `claude -p --continue --output-format stream-json`:

```typescript
import { spawn } from 'child_process';

function queryClaudeOneShot(prompt: string) {
  const proc = spawn('claude', [
    '-p', '--continue',
    '--output-format', 'stream-json',
    prompt,
  ], { cwd: CONFIG.projectDir });
  // Parse NDJSON from stdout
  // Each line is JSON with type: "assistant" | "result" | "system"
  // "result" = end → clean completion signal
}
```

**Trade-off:** Loses persistent session (each message = new process, but `--continue` preserves context). Gains: clean JSON output without ANSI parsing, deterministic end detection (`type: "result"`), no TUI issues. Slash commands (`/compact`, `/clear`, etc.) don't work in `-p` mode.

## Implementation Phases

| Phase | Scope | Status |
|-------|-------|--------|
| 1 — MVP | config, auth, session, output-parser, telegram-stream, index (DM only) | Done |
| 2 — Commands | handlers, keyboards, registry | Done |
| 3 — Custom commands | scan .claude/commands/, inline keyboard, /project:* handler | Done |
| 4 — Groups | @mention/reply filtering, forwarding, per-chatId sessions | Done |
| 5 — Tuning | debug logging, filterNoise tuning, idle timeout adjustments | Ongoing |
