import { Bot, Context } from 'grammy';
import { SessionManager } from '../session.js';
import { OutputParser } from '../output-parser.js';
import { TelegramStreamer } from '../telegram-stream.js';
import { getMainMenu, getCustomCommandsKeyboard, getModelKeyboard } from './keyboards.js';

export function registerCommands(
  bot: Bot<Context>,
  sessions: SessionManager,
  _parser: OutputParser,
  streamer: TelegramStreamer,
) {

  bot.command('start', async (ctx) => {
    await ctx.reply(
      'Claude Code Bridge\n\n' +
      'Send messages — they go straight to Claude Code CLI.\n' +
      'First message automatically starts a session.\n\n' +
      '/menu — command panel\n' +
      '/close — close session\n' +
      '/status — session status',
      { reply_markup: getMainMenu() }
    );
  });

  bot.command('menu', async (ctx) => {
    await ctx.reply('Command panel:', { reply_markup: getMainMenu() });
  });

  bot.command('close', async (ctx) => {
    const chatId = ctx.chat.id;
    if (!sessions.isAlive(chatId)) {
      await ctx.reply('No active session.');
      return;
    }
    sessions.close(chatId);
    await ctx.reply('Session closed.');
  });

  bot.command('status', async (ctx) => {
    const alive = sessions.isAlive(ctx.chat.id);
    await ctx.reply(alive ? 'Session active' : 'No active session');
  });

  for (const cmd of ['compact', 'clear', 'cost', 'model', 'memory']) {
    bot.command(cmd, async (ctx) => {
      const chatId = ctx.chat.id;
      if (!sessions.isAlive(chatId)) {
        await ctx.reply('No active session. Send a message to start one.');
        return;
      }
      await streamer.startStream(chatId);
      sessions.sendCommand(chatId, `/${cmd}`);
    });
  }

  bot.command('commands', async (ctx) => {
    const keyboard = getCustomCommandsKeyboard();
    await ctx.reply('Custom commands:', { reply_markup: keyboard });
  });

  bot.callbackQuery(/^cc:(.+)$/, async (ctx) => {
    const cmd = ctx.match[1];
    const chatId = ctx.chat!.id;
    await ctx.answerCallbackQuery({ text: `Running /project:${cmd}...` });

    if (!sessions.isAlive(chatId)) {
      sessions.spawn(chatId);
      sessions.once('ready', () => {
        sessions.sendCommand(chatId, `/project:${cmd}`);
      });
    } else {
      sessions.sendCommand(chatId, `/project:${cmd}`);
    }
    await streamer.startStream(chatId);
  });

  bot.callbackQuery(/^act:(.+)$/, async (ctx) => {
    const action = ctx.match[1];
    const chatId = ctx.chat!.id;
    await ctx.answerCallbackQuery();

    switch (action) {
      case 'menu':
        await ctx.editMessageText('Command panel:', { reply_markup: getMainMenu() });
        break;
      case 'commands':
        await ctx.editMessageText('Custom commands:', {
          reply_markup: getCustomCommandsKeyboard()
        });
        break;
      case 'model':
        await ctx.editMessageText('Choose model:', { reply_markup: getModelKeyboard() });
        break;
      case 'close':
        sessions.close(chatId);
        await ctx.editMessageText('Session closed.');
        break;
      case 'continue':
      case 'clear':
      case 'compact':
      case 'cost':
      case 'memory':
        if (!sessions.isAlive(chatId)) {
          await ctx.editMessageText('No active session.');
          return;
        }
        await streamer.startStream(chatId);
        sessions.sendCommand(chatId, `/${action}`);
        break;
    }
  });

  bot.callbackQuery(/^model:(.+)$/, async (ctx) => {
    const model = ctx.match[1];
    const chatId = ctx.chat!.id;
    await ctx.answerCallbackQuery({ text: `Switching to ${model}...` });
    if (sessions.isAlive(chatId)) {
      sessions.sendCommand(chatId, `/model`);
      setTimeout(() => sessions.write(chatId, model), 1500);
    }
  });

  bot.hears(/^\/(project:.+)$/, async (ctx) => {
    const cmd = '/' + ctx.match[1];
    const chatId = ctx.chat.id;
    if (!sessions.isAlive(chatId)) {
      sessions.spawn(chatId);
      sessions.once('ready', () => sessions.sendCommand(chatId, cmd));
    } else {
      sessions.sendCommand(chatId, cmd);
    }
    await streamer.startStream(chatId);
  });
}
