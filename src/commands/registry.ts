import { Bot, Context } from 'grammy';

export async function registerBotCommands(bot: Bot<Context>) {
  const commands = [
    { command: 'menu', description: 'Command panel (inline keyboard)' },
    { command: 'close', description: 'Close Claude Code session' },
    { command: 'status', description: 'Session status' },
    { command: 'compact', description: 'Compress session context' },
    { command: 'clear', description: 'Clear session history' },
    { command: 'cost', description: 'Show token usage' },
    { command: 'model', description: 'Change model' },
    { command: 'memory', description: 'Show/edit CLAUDE.md' },
    { command: 'commands', description: 'List custom commands' },
    { command: 'help', description: 'Help' },
  ];

  await bot.api.setMyCommands(commands);
}
