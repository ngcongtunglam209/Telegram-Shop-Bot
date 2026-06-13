import { Bot, InlineKeyboard } from 'grammy';
import { BOT_TOKEN, ADMIN_IDS } from './config.js';
import { t } from './i18n/index.js';
import { getUserLocale, setUserLanguage } from './models/user.js';
import { userSync } from './middleware/userSync.js';
import { adminOnly } from './middleware/adminOnly.js';
import { handleShop, handleCategory, handleProductDetail, handleAddToCart } from './handlers/shop.js';
import { handleCart, handleClearCart, handleRemoveItem } from './handlers/cart.js';
import { handleCheckout, handleCancelOrder, handlePayMethod } from './handlers/payment.js';
import { handleMyOrders } from './handlers/order.js';
import { handleAdminMain, handleAdminCallback, handleAdminText } from './handlers/admin.js';

export const bot = new Bot(BOT_TOKEN);

bot.use(userSync);

// ── /start — language picker ──────────────────────────────────────────────

bot.command('start', async ctx => {
  const kb = new InlineKeyboard()
    .text('🇬🇧 English', 'setlang:en')
    .text('🇻🇳 Tiếng Việt', 'setlang:vi');

  await ctx.reply(
    '🌐 Please select your language\nVui lòng chọn ngôn ngữ của bạn:',
    { reply_markup: kb },
  );
});

// ── Language selection ────────────────────────────────────────────────────

bot.callbackQuery(/^setlang:(en|vi)$/, async ctx => {
  const lang = ctx.callbackQuery.data.split(':')[1] as 'en' | 'vi';
  const userId = ctx.from.id;
  setUserLanguage(userId, lang);

  const locale = lang;
  const name = ctx.from.first_name;

  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    t(locale, 'welcome', { name }),
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '🏪 Shop', callback_data: 'shop' },
          { text: '🛒 Cart', callback_data: 'cart' },
          { text: '📋 Orders', callback_data: 'orders' },
        ]],
      },
    },
  );
});

// ── Persistent reply keyboard commands ───────────────────────────────────

bot.command('shop', ctx => handleShop(ctx));
bot.command('cart', ctx => handleCart(ctx));
bot.command('orders', ctx => handleMyOrders(ctx));
bot.command('admin', adminOnly, ctx => handleAdminMain(ctx));

bot.hears('🏪 Shop', ctx => handleShop(ctx));
bot.hears('🛒 Cart', ctx => handleCart(ctx));
bot.hears('📋 My Orders', ctx => handleMyOrders(ctx));

// ── Callback queries ──────────────────────────────────────────────────────

bot.callbackQuery('shop', ctx => handleShop(ctx));
bot.callbackQuery('cart', ctx => handleCart(ctx));
bot.callbackQuery('orders', ctx => handleMyOrders(ctx));
bot.callbackQuery('clearcart', ctx => handleClearCart(ctx));
bot.callbackQuery('checkout', ctx => handleCheckout(ctx));

bot.callbackQuery(/^cat:\d+$/, ctx => handleCategory(ctx));
bot.callbackQuery(/^product:\d+$/, ctx => handleProductDetail(ctx));
bot.callbackQuery(/^addcart:\d+$/, ctx => handleAddToCart(ctx));
bot.callbackQuery(/^removecart:\d+$/, ctx => handleRemoveItem(ctx));
bot.callbackQuery(/^pay_method:(sepay|ntpay)$/, ctx => handlePayMethod(ctx));
bot.callbackQuery(/^cancelorder:\d+$/, ctx => handleCancelOrder(ctx));

bot.callbackQuery(/^admin:/, adminOnly, ctx => handleAdminCallback(ctx));

// ── Text fallback ─────────────────────────────────────────────────────────

bot.on('message:text', async (ctx, next) => {
  if (ADMIN_IDS.includes(ctx.from.id)) {
    const handled = await handleAdminText(ctx);
    if (handled) return;
  }
  await next();
});

bot.on('message:text', async ctx => {
  const locale = getUserLocale(ctx.from.id);
  await ctx.reply(t(locale, 'welcome', { name: ctx.from.first_name }));
});
