import 'dotenv/config';

export const CONFIG = {
  botToken: process.env.BOT_TOKEN!,
  allowedUsers: new Set(process.env.ALLOWED_USERS!.split(',').map(Number)),
  groupChatId: process.env.GROUP_CHAT_ID ? Number(process.env.GROUP_CHAT_ID) : null,
  projectDir: process.env.PROJECT_DIR!,
  ptyCols: Number(process.env.PTY_COLS ?? 120),
  ptyRows: Number(process.env.PTY_ROWS ?? 40),
  streamDebounceMs: Number(process.env.STREAM_DEBOUNCE_MS ?? 800),
  idleTimeoutMs: Number(process.env.IDLE_TIMEOUT_MS ?? 2000),
  sessionTimeoutMs: Number(process.env.SESSION_TIMEOUT_MS ?? 1800000),
} as const;
