import type { Context, NextFunction } from 'grammy';
import { ADMIN_IDS } from '../config.js';

export async function adminOnly(ctx: Context, next: NextFunction): Promise<void> {
  if (!ctx.from || !ADMIN_IDS.includes(ctx.from.id)) {
    await ctx.reply('⛔ Admin access required.');
    return;
  }
  await next();
}
