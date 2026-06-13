import { InlineKeyboard, type CallbackQueryContext, type Context } from 'grammy';
import { SERVER_URL, ORDER_EXPIRE_MINUTES, SEPAY_MERCHANT_ID, NTPAY_BASE_URL } from '../config.js';
import { cartTotalUsdtCents, cartTotalVnd, clearCart, getCart } from '../models/cart.js';
import {
  addOrderItem,
  confirmOrderPayment,
  createOrder,
  getOrderById,
  getOrderItems,
  setOrderPaymentRef,
  updateOrderStatus,
} from '../models/order.js';
import { getAvailableKey, markKeyUsed } from '../models/product.js';
import { createInvoice } from '../services/ntpay.js';
import { vndToUsdtCents } from '../services/exchangeRate.js';
import { type Locale, t } from '../i18n/index.js';
import { getUserLocale } from '../models/user.js';
import { formatPriceUsdt, formatPriceVnd, currentRateLabel } from '../utils/format.js';
import { checkoutMethodKeyboard } from '../utils/keyboards.js';

// ── Checkout: show payment method selection ───────────────────────────────

export async function handleCheckout(ctx: CallbackQueryContext<Context>): Promise<void> {
  const locale = getUserLocale(ctx.from!.id);
  const userId = ctx.from!.id;
  const items = getCart(userId);
  if (items.length === 0) { await ctx.answerCallbackQuery(t(locale, 'cart_empty')); return; }

  const totalVnd = cartTotalVnd(items);
  const totalUsdtCents = cartTotalUsdtCents(items); // live rate

  const lines = items.map(i => {
    const lineVnd = formatPriceVnd((i.price_vnd ?? 0) * i.quantity);
    const lineUsdt = formatPriceUsdt(vndToUsdtCents((i.price_vnd ?? 0) * i.quantity));
    return locale === 'vi'
      ? `• *${i.name}* x${i.quantity} — ${lineVnd}`
      : `• *${i.name}* x${i.quantity} — ${lineUsdt}`;
  });

  const kb = checkoutMethodKeyboard(
    locale,
    formatPriceVnd(totalVnd),
    (totalUsdtCents / 100).toFixed(2),
    !!SEPAY_MERCHANT_ID,
    !!NTPAY_BASE_URL,
  );

  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    `${t(locale, 'checkout_title')}\n\n${lines.join('\n')}\n\n` +
      `_${currentRateLabel()}_`,
    { parse_mode: 'Markdown', reply_markup: kb },
  );
}

// ── Payment method chosen ─────────────────────────────────────────────────

export async function handlePayMethod(ctx: CallbackQueryContext<Context>): Promise<void> {
  const locale = getUserLocale(ctx.from!.id);
  const method = ctx.callbackQuery.data.split(':')[1] as 'sepay' | 'ntpay';
  const userId = ctx.from!.id;
  const items = getCart(userId);
  if (items.length === 0) { await ctx.answerCallbackQuery(t(locale, 'cart_empty')); return; }

  const totalVnd = cartTotalVnd(items);
  const totalUsdtCents = vndToUsdtCents(totalVnd); // snapshot current rate

  const order = createOrder(userId, method, totalVnd, totalUsdtCents);
  for (const item of items) {
    const itemUsdtCents = vndToUsdtCents((item.price_vnd ?? 0) * item.quantity);
    addOrderItem(order.id, item.product_id, item.quantity, (item.price_vnd ?? 0) * item.quantity, itemUsdtCents);
  }
  clearCart(userId);

  await ctx.answerCallbackQuery();
  if (method === 'sepay') await showSePayCheckout(ctx, order.id, totalVnd, locale);
  else                    await showNtpayCheckout(ctx, order.id, totalUsdtCents, locale);
}

// ── SePay (VND) ───────────────────────────────────────────────────────────

async function showSePayCheckout(
  ctx: CallbackQueryContext<Context>,
  orderId: number,
  totalVnd: number,
  locale: Locale,
): Promise<void> {
  const kb = new InlineKeyboard()
    .url(t(locale, 'open_sepay'), `${SERVER_URL}/checkout/${orderId}`)
    .row()
    .text(t(locale, 'cancel_order'), `cancelorder:${orderId}`)
    .row()
    .text(t(locale, 'continue_shopping'), 'shop');

  await ctx.editMessageText(
    `${t(locale, 'sepay_header', { id: orderId })}\n\n` +
      `${t(locale, 'amount_label')}: *${formatPriceVnd(totalVnd)}*\n` +
      `${t(locale, 'expires_in', { minutes: ORDER_EXPIRE_MINUTES })}\n\n` +
      t(locale, 'sepay_instructions'),
    { parse_mode: 'Markdown', reply_markup: kb },
  );
}

// ── NTPAY (USDT) ──────────────────────────────────────────────────────────

async function showNtpayCheckout(
  ctx: CallbackQueryContext<Context>,
  orderId: number,
  totalUsdtCents: number,
  locale: Locale,
): Promise<void> {
  const amountReal = totalUsdtCents / 100;
  let invoice;
  try {
    invoice = await createInvoice(orderId, amountReal, `Order #${orderId}`, `Digital Shop order #${orderId}`);
  } catch (err) {
    console.error('[NTPAY] createInvoice failed:', err);
    updateOrderStatus(orderId, 'cancelled');
    await ctx.editMessageText(`❌ Could not create USDT invoice. Order #${orderId} cancelled. Please try again.`);
    return;
  }

  setOrderPaymentRef(orderId, invoice.transId);

  const kb = new InlineKeyboard()
    .url(t(locale, 'open_usdt'), invoice.urlPayment)
    .row()
    .text(t(locale, 'cancel_order'), `cancelorder:${orderId}`)
    .row()
    .text(t(locale, 'continue_shopping'), 'shop');

  await ctx.editMessageText(
    `${t(locale, 'usdt_header', { id: orderId })}\n\n` +
      `${t(locale, 'amount_label')}: *${invoice.amount} USDT*\n` +
      `${t(locale, 'ref_label')}: \`${invoice.transId}\`\n` +
      `${t(locale, 'expires_in', { minutes: ORDER_EXPIRE_MINUTES })}\n\n` +
      t(locale, 'usdt_instructions'),
    { parse_mode: 'Markdown', reply_markup: kb },
  );
}

// ── Cancel ────────────────────────────────────────────────────────────────

export async function handleCancelOrder(ctx: CallbackQueryContext<Context>): Promise<void> {
  const locale = getUserLocale(ctx.from!.id);
  const orderId = Number(ctx.callbackQuery.data.split(':')[1]);
  const order = getOrderById(orderId);
  if (!order || order.user_id !== ctx.from!.id) { await ctx.answerCallbackQuery(t(locale, 'order_not_found')); return; }
  if (order.status !== 'pending') { await ctx.answerCallbackQuery(t(locale, 'cancel_processed')); return; }
  updateOrderStatus(orderId, 'cancelled');
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(t(locale, 'order_cancelled', { id: orderId }));
}

// ── Deliver (called by webhooks + admin) ──────────────────────────────────

export async function deliverOrder(
  sendMessage: (text: string) => Promise<void>,
  orderId: number,
  paymentRef: string,
  locale: Locale = 'en',
): Promise<boolean> {
  const confirmed = confirmOrderPayment(orderId, paymentRef);
  if (!confirmed) return false;

  const items = getOrderItems(orderId);
  const deliveries: string[] = [];
  let allDelivered = true;

  for (const item of items) {
    for (let i = 0; i < item.quantity; i++) {
      const key = getAvailableKey(item.product_id);
      if (key) {
        markKeyUsed(key.id, orderId);
        deliveries.push(`🔑 *${item.name}*: \`${key.key_value}\``);
      } else {
        allDelivered = false;
        deliveries.push(t(locale, 'key_missing', { name: item.name ?? '' }));
      }
    }
  }

  if (allDelivered) updateOrderStatus(orderId, 'delivered');

  await sendMessage(
    `${t(locale, 'delivered_header', { id: orderId })}\n\n` +
      `${t(locale, 'delivered_items')}\n\n${deliveries.join('\n')}\n\n` +
      t(locale, 'delivered_thanks'),
  );
  return true;
}
