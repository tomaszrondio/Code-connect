import { Bot, Context } from 'grammy';
import { CONFIG } from './config.js';

const MAX_MSG_LEN = 4096;

export class TelegramStreamer {
  private activeMessages = new Map<number, number>();
  private debounceTimers = new Map<number, NodeJS.Timeout>();

  constructor(private bot: Bot<Context>) {}

  async startStream(chatId: number): Promise<void> {
    const msg = await this.bot.api.sendMessage(chatId, '...');
    this.activeMessages.set(chatId, msg.message_id);
  }

  scheduleUpdate(chatId: number, text: string): void {
    const existing = this.debounceTimers.get(chatId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      await this.doUpdate(chatId, text + ' \u258c');
    }, CONFIG.streamDebounceMs);
    this.debounceTimers.set(chatId, timer);
  }

  async finalize(chatId: number, text: string): Promise<void> {
    const timer = this.debounceTimers.get(chatId);
    if (timer) clearTimeout(timer);
    this.debounceTimers.delete(chatId);

    if (!text.trim()) {
      const msgId = this.activeMessages.get(chatId);
      if (msgId) {
        await this.bot.api.deleteMessage(chatId, msgId).catch(() => {});
      }
      this.activeMessages.delete(chatId);
      return;
    }

    if (text.length > MAX_MSG_LEN) {
      const parts = this.splitMessage(text);

      await this.doUpdate(chatId, parts[0]);

      for (let i = 1; i < parts.length; i++) {
        await this.bot.api.sendMessage(chatId, parts[i]).catch(() => {});
      }
    } else {
      await this.doUpdate(chatId, text);
    }

    if (CONFIG.groupChatId && chatId !== CONFIG.groupChatId) {
      await this.forwardToGroup(text);
    }

    this.activeMessages.delete(chatId);
  }

  private async forwardToGroup(text: string): Promise<void> {
    if (!CONFIG.groupChatId) return;
    const parts = this.splitMessage(
      text.length > MAX_MSG_LEN ? text : `Claude Code:\n\n${text}`
    );
    for (const part of parts) {
      await this.bot.api.sendMessage(CONFIG.groupChatId, part).catch(() => {});
    }
  }

  private async doUpdate(chatId: number, text: string): Promise<void> {
    const msgId = this.activeMessages.get(chatId);
    if (!msgId) return;

    const display = text.length > MAX_MSG_LEN
      ? '\u2026' + text.slice(-(MAX_MSG_LEN - 5)) + ' \u258c'
      : text;

    await this.bot.api.editMessageText(chatId, msgId, display)
      .catch(() => {});
  }

  private splitMessage(text: string): string[] {
    if (text.length <= MAX_MSG_LEN) return [text];
    const parts: string[] = [];
    let remaining = text;
    while (remaining.length > 0) {
      if (remaining.length <= MAX_MSG_LEN) {
        parts.push(remaining);
        break;
      }
      let idx = remaining.lastIndexOf('\n\n', MAX_MSG_LEN);
      if (idx < MAX_MSG_LEN * 0.3) idx = remaining.lastIndexOf('\n', MAX_MSG_LEN);
      if (idx < MAX_MSG_LEN * 0.3) idx = remaining.lastIndexOf(' ', MAX_MSG_LEN);
      if (idx < MAX_MSG_LEN * 0.3) idx = MAX_MSG_LEN;
      parts.push(remaining.substring(0, idx));
      remaining = remaining.substring(idx).trimStart();
    }
    return parts;
  }
}
