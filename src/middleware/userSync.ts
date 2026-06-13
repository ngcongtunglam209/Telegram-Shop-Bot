import type { Context, NextFunction } from 'grammy';
import { upsertUser } from '../models/user.js';

export async function userSync(ctx: Context, next: NextFunction): Promise<void> {
  const user = ctx.from;
  if (user) {
    upsertUser(user.id, user.first_name, user.username);
  }
  await next();
}
