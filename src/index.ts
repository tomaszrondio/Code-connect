import { Bot } from 'grammy';
import { autoRetry } from '@grammyjs/auto-retry';
import { CONFIG } from './config.js';
import { authMiddleware } from './auth.js';
import { SessionManager } from './session.js';
import { OutputParser } from './output-parser.js';
import { TelegramStreamer } from './telegram-stream.js';
import { registerCommands } from './commands/handlers.js';
import { registerBotCommands } from './commands/registry.js';

const bot = new Bot(CONFIG.botToken);
const sessions = new SessionManager();
const parser = new OutputParser();
const streamer = new TelegramStreamer(bot);

bot.api.config.use(autoRetry({ maxRetryAttempts: 3 }));
bot.use(authMiddleware);

registerCommands(bot, sessions, parser, streamer);

bot.on('message:text', async (ctx) => {
  const chatId = ctx.chat.id;
  const text = ctx.message.text;

  if (text.startsWith('/')) return;

  // In group chats: only respond to replies or @mentions
  if (ctx.chat.type !== 'private') {
    const botInfo = await bot.api.getMe();
    const isReply = ctx.message.reply_to_message?.from?.id === botInfo.id;
    const isMention = text.includes(`@${botInfo.username}`);
    if (!isReply && !isMention) return;
  }

  if (!sessions.isAlive(chatId)) {
    sessions.spawn(chatId);
    await ctx.reply('Starting Claude Code session...');

    sessions.once('ready', async () => {
      parser.setInputEcho(chatId, text);
      await streamer.startStream(chatId);
      sessions.write(chatId, text);
    });
    return;
  }

  parser.setInputEcho(chatId, text);
  await streamer.startStream(chatId);
  sessions.write(chatId, text);
});

// PTY data -> parse -> stream to Telegram
sessions.on('data', (chatId: number, rawData: string) => {
  const cleaned = parser.processChunk(chatId, rawData);
  if (cleaned && parser.hasChanged(chatId)) {
    streamer.scheduleUpdate(chatId, cleaned);
    parser.markSent(chatId);
  }
});

// Claude finished responding -> final message
sessions.on('idle', async (chatId: number) => {
  const final = parser.flush(chatId);
  await streamer.finalize(chatId, final);
});

// Session exited (crash/exit)
sessions.on('exit', async (chatId: number, code: number) => {
  const final = parser.flush(chatId);
  if (final) await streamer.finalize(chatId, final);
  await bot.api.sendMessage(chatId, `Session ended (exit code: ${code}).`).catch(() => {});
});

// Session timeout
sessions.on('timeout', async (chatId: number) => {
  await bot.api.sendMessage(chatId, 'Session closed due to inactivity.').catch(() => {});
});

async function main() {
  await registerBotCommands(bot);
  console.log('Claude Code Telegram Bridge started');
  console.log(`Project: ${CONFIG.projectDir}`);
  console.log(`Allowed users: ${[...CONFIG.allowedUsers].join(', ')}`);
  bot.start();
}

main().catch(console.error);
