import type { CallbackQueryContext, Context } from 'grammy';
import { getUserOrders } from '../models/order.js';
import { t } from '../i18n/index.js';
import { getUserLocale } from '../models/user.js';
import { formatPriceUsdt, formatPriceVnd } from '../utils/format.js';

export async function handleMyOrders(ctx: Context | CallbackQueryContext<Context>): Promise<void> {
  const locale = getUserLocale(ctx.from!.id);
  const orders = getUserOrders(ctx.from!.id);
  const edit = 'callbackQuery' in ctx;

  if (orders.length === 0) {
    const text = t(locale, 'orders_empty');
    if (edit) { await ctx.answerCallbackQuery(); await ctx.editMessageText(text); }
    else await (ctx as Context).reply(text);
    return;
  }

  const statusKey = (s: string) =>
    t(locale, `status_${s}` as Parameters<typeof t>[1]);

  const methodKey = (m: string) =>
    t(locale, m === 'ntpay' ? 'method_ntpay' : 'method_sepay');

  const lines = orders.slice(0, 10).map(o => {
    const amount = o.payment_method === 'ntpay'
      ? formatPriceUsdt(o.total_usdt)
      : formatPriceVnd(o.total_vnd);
    return `• #${o.id} ${methodKey(o.payment_method)} — ${amount} — ${statusKey(o.status)}`;
  });

  const text = `${t(locale, 'orders_title')}\n\n${lines.join('\n')}`;
  if (edit) {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(text, { parse_mode: 'Markdown' });
  } else {
    await (ctx as Context).reply(text, { parse_mode: 'Markdown' });
  }
}
