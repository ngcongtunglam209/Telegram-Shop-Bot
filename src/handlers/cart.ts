import type { CallbackQueryContext, Context } from 'grammy';
import { cartTotalUsdtCents, cartTotalVnd, clearCart, getCart, removeFromCart } from '../models/cart.js';
import { t } from '../i18n/index.js';
import { getUserLocale } from '../models/user.js';
import { formatPriceUsdt, formatPriceVnd } from '../utils/format.js';
import { cartKeyboard } from '../utils/keyboards.js';

export async function handleCart(ctx: Context | CallbackQueryContext<Context>): Promise<void> {
  const locale = getUserLocale(ctx.from!.id);
  const userId = ctx.from!.id;
  const items = getCart(userId);
  const edit = 'callbackQuery' in ctx;

  if (items.length === 0) {
    const text = t(locale, 'cart_empty');
    if (edit) { await ctx.answerCallbackQuery(); await ctx.editMessageText(text, { reply_markup: cartKeyboard(false, locale) }); }
    else await (ctx as Context).reply(text, { reply_markup: cartKeyboard(false, locale) });
    return;
  }

  const totalVnd = cartTotalVnd(items);
  const totalUsdtCents = cartTotalUsdtCents(items);

  const lines = items.map(i => {
    const vnd = formatPriceVnd((i.price_vnd ?? 0) * i.quantity);
    const usdt = formatPriceUsdt(cartTotalUsdtCents([i]));
    return locale === 'vi'
      ? `• *${i.name}* x${i.quantity} — ${vnd}`
      : `• *${i.name}* x${i.quantity} — ${usdt}`;
  });

  const total = locale === 'vi'
    ? `${t(locale, 'cart_total')}: *${formatPriceVnd(totalVnd)}* *(≈ ${formatPriceUsdt(totalUsdtCents)})*`
    : `${t(locale, 'cart_total')}: *${formatPriceUsdt(totalUsdtCents)}* *(≈ ${formatPriceVnd(totalVnd)})*`;

  const text = `${t(locale, 'cart_title')}\n\n${lines.join('\n')}\n\n${total}`;

  if (edit) {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: cartKeyboard(true, locale) });
  } else {
    await (ctx as Context).reply(text, { parse_mode: 'Markdown', reply_markup: cartKeyboard(true, locale) });
  }
}

export async function handleClearCart(ctx: CallbackQueryContext<Context>): Promise<void> {
  const locale = getUserLocale(ctx.from!.id);
  clearCart(ctx.from!.id);
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(t(locale, 'cart_cleared'), { reply_markup: cartKeyboard(false, locale) });
}

export async function handleRemoveItem(ctx: CallbackQueryContext<Context>): Promise<void> {
  const productId = Number(ctx.callbackQuery.data.split(':')[1]);
  removeFromCart(ctx.from!.id, productId);
  await ctx.answerCallbackQuery();
  await handleCart(ctx);
}
