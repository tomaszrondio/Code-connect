import { Context, NextFunction } from 'grammy';
import { CONFIG } from './config.js';

export async function authMiddleware(ctx: Context, next: NextFunction) {
  const userId = ctx.from?.id;
  if (!userId || !CONFIG.allowedUsers.has(userId)) {
    await ctx.reply(`Access denied. Your ID: ${userId}`);
    return;
  }
  return next();
}
