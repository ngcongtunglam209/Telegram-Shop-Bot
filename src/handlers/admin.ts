import { type CallbackQueryContext, type Context, InlineKeyboard } from 'grammy';
import {
  addKeys,
  createCategory,
  createProduct,
  deleteCategory,
  deleteProduct,
  getAllProducts,
  getCategories,
  getCategoryById,
  getProductById,
  updateProduct,
} from '../models/product.js';
import { getAllOrders, getOrderById, getOrderItems, updateOrderStatus } from '../models/order.js';
import { formatPriceUsdt, formatPriceVnd, currentRateLabel } from '../utils/format.js';
import { t } from '../i18n/index.js';

const formatOrderStatus = (s: string) => t('en', `status_${s}` as Parameters<typeof t>[1]);
const formatPaymentMethod = (m: string) => t('en', m === 'ntpay' ? 'method_ntpay' : 'method_sepay');
import { vndToUsdtCents } from '../services/exchangeRate.js';
import {
  adminCategoriesKeyboard,
  adminMainKeyboard,
  adminProductsKeyboard,
} from '../utils/keyboards.js';
import { deliverOrder } from './payment.js';

const adminState = new Map<number, { step: string; data: Record<string, unknown> }>();

export async function handleAdminMain(ctx: Context | CallbackQueryContext<Context>): Promise<void> {
  const text = '🔧 *Admin Panel*\n\nChoose an action:';
  if ('callbackQuery' in ctx) {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: adminMainKeyboard() });
  } else {
    await (ctx as Context).reply(text, { parse_mode: 'Markdown', reply_markup: adminMainKeyboard() });
  }
}

export async function handleAdminCallback(ctx: CallbackQueryContext<Context>): Promise<void> {
  const data = ctx.callbackQuery.data;
  const adminId = ctx.from!.id;

  if (data === 'admin:main') return handleAdminMain(ctx);

  if (data === 'admin:categories') {
    const cats = getCategories();
    await ctx.answerCallbackQuery();
    await ctx.editMessageText('📂 *Categories* — tap to delete, or add new:', {
      parse_mode: 'Markdown',
      reply_markup: adminCategoriesKeyboard(cats),
    });
    return;
  }

  if (data === 'admin:products') {
    const prods = getAllProducts();
    await ctx.answerCallbackQuery();
    await ctx.editMessageText('📦 *Products* — tap to edit/toggle:', {
      parse_mode: 'Markdown',
      reply_markup: adminProductsKeyboard(prods),
    });
    return;
  }

  if (data === 'admin:orders') {
    const orders = getAllOrders(20);
    if (orders.length === 0) {
      await ctx.answerCallbackQuery();
      await ctx.editMessageText('📋 No orders yet.', {
        reply_markup: new InlineKeyboard().text('⬅️ Back', 'admin:main'),
      });
      return;
    }
    const kb = new InlineKeyboard();
    for (const o of orders) {
      const amount = o.payment_method === 'ntpay' ? formatPriceUsdt(o.total_usdt) : formatPriceVnd(o.total_vnd);
      kb.text(`#${o.id} ${formatPaymentMethod(o.payment_method)} ${amount} — ${formatOrderStatus(o.status)}`, `admin:order:${o.id}`).row();
    }
    kb.text('⬅️ Back', 'admin:main');
    await ctx.answerCallbackQuery();
    await ctx.editMessageText('📋 *Recent Orders*', { parse_mode: 'Markdown', reply_markup: kb });
    return;
  }

  if (data.startsWith('admin:order:')) {
    const orderId = Number(data.split(':')[2]);
    const order = getOrderById(orderId);
    if (!order) { await ctx.answerCallbackQuery('Not found.'); return; }
    const items = getOrderItems(orderId);
    const lines = items.map(i => {
      const price = order.payment_method === 'ntpay'
        ? formatPriceUsdt(i.price_usdt)
        : formatPriceVnd(i.price_vnd * i.quantity);
      return `• ${i.name} x${i.quantity} — ${price}`;
    });
    const total = order.payment_method === 'ntpay'
      ? formatPriceUsdt(order.total_usdt)
      : formatPriceVnd(order.total_vnd);
    const kb = new InlineKeyboard()
      .text('📦 Deliver Manually', `admin:deliver:${orderId}`).row()
      .text('❌ Cancel', `admin:cancelorder:${orderId}`).row()
      .text('⬅️ Back', 'admin:orders');
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `📋 *Order #${orderId}*\n${formatPaymentMethod(order.payment_method)} | ${formatOrderStatus(order.status)}\n\n${lines.join('\n')}\n\n*Total: ${total}*`,
      { parse_mode: 'Markdown', reply_markup: kb },
    );
    return;
  }

  if (data.startsWith('admin:deliver:')) {
    const orderId = Number(data.split(':')[2]);
    const order = getOrderById(orderId);
    if (!order) { await ctx.answerCallbackQuery('Order not found.'); return; }
    await deliverOrder(
      async text => { await ctx.api.sendMessage(order.user_id, text, { parse_mode: 'Markdown' }); },
      orderId,
      'admin-manual',
    );
    await ctx.answerCallbackQuery('Delivered.');
    await ctx.editMessageText(`📦 Order #${orderId} delivered.`);
    return;
  }

  if (data.startsWith('admin:cancelorder:')) {
    const orderId = Number(data.split(':')[2]);
    updateOrderStatus(orderId, 'cancelled');
    await ctx.answerCallbackQuery('Cancelled.');
    await ctx.editMessageText(`❌ Order #${orderId} cancelled.`);
    return;
  }

  if (data.startsWith('admin:delcat:')) {
    const catId = Number(data.split(':')[2]);
    const cat = getCategoryById(catId);
    if (!cat) { await ctx.answerCallbackQuery('Not found.'); return; }
    deleteCategory(catId);
    await ctx.answerCallbackQuery(`Deleted "${cat.name}".`);
    await ctx.editMessageText('📂 *Categories*:', {
      parse_mode: 'Markdown',
      reply_markup: adminCategoriesKeyboard(getCategories()),
    });
    return;
  }

  if (data === 'admin:newcat') {
    adminState.set(adminId, { step: 'newcat:name', data: {} });
    await ctx.answerCallbackQuery();
    await ctx.reply('📂 Enter new category name (or /cancel):');
    return;
  }

  if (data === 'admin:newprod') {
    const cats = getCategories();
    if (cats.length === 0) { await ctx.answerCallbackQuery('Create a category first.'); return; }
    adminState.set(adminId, { step: 'newprod:category', data: {} });
    const kb = new InlineKeyboard();
    for (const c of cats) kb.text(`${c.emoji} ${c.name}`, `admin:pickcat:${c.id}`).row();
    await ctx.answerCallbackQuery();
    await ctx.reply('📦 Select category for new product:', { reply_markup: kb });
    return;
  }

  if (data.startsWith('admin:pickcat:')) {
    const state = adminState.get(adminId);
    if (!state) { await ctx.answerCallbackQuery(); return; }
    state.data.category_id = Number(data.split(':')[2]);
    state.step = 'newprod:name';
    await ctx.answerCallbackQuery();
    await ctx.reply('📦 Enter product name (or /cancel):');
    return;
  }

  if (data.startsWith('admin:editprod:')) {
    const prod = getProductById(Number(data.split(':')[2]));
    if (!prod) { await ctx.answerCallbackQuery('Not found.'); return; }
    const kb = new InlineKeyboard()
      .text(prod.active ? '❌ Deactivate' : '✅ Activate', `admin:toggleprod:${prod.id}`).row()
      .text('🗑 Delete', `admin:delprod:${prod.id}`).row()
      .text('🔑 Add Keys', `admin:addkeysfor:${prod.id}`).row()
      .text('⬅️ Back', 'admin:products');
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `📦 *${prod.name}*\n${prod.description}\n` +
      `💳 ${formatPriceVnd(prod.price_vnd)}  →  💎 ${formatPriceUsdt(vndToUsdtCents(prod.price_vnd))} _(live)_\n` +
      `Status: ${prod.active ? '✅ Active' : '❌ Inactive'}`,
      { parse_mode: 'Markdown', reply_markup: kb },
    );
    return;
  }

  if (data.startsWith('admin:toggleprod:')) {
    const prod = getProductById(Number(data.split(':')[2]));
    if (!prod) { await ctx.answerCallbackQuery('Not found.'); return; }
    updateProduct(prod.id, { active: prod.active ? 0 : 1 });
    await ctx.answerCallbackQuery(`${prod.active ? 'Deactivated' : 'Activated'}.`);
    const updated = getProductById(prod.id)!;
    const kb = new InlineKeyboard()
      .text(updated.active ? '❌ Deactivate' : '✅ Activate', `admin:toggleprod:${prod.id}`).row()
      .text('🗑 Delete', `admin:delprod:${prod.id}`).row()
      .text('🔑 Add Keys', `admin:addkeysfor:${prod.id}`).row()
      .text('⬅️ Back', 'admin:products');
    await ctx.editMessageText(
      `📦 *${updated.name}*\n${updated.description}\n` +
      `💳 ${formatPriceVnd(updated.price_vnd)}  →  💎 ${formatPriceUsdt(vndToUsdtCents(updated.price_vnd))} _(live)_\n` +
      `Status: ${updated.active ? '✅ Active' : '❌ Inactive'}`,
      { parse_mode: 'Markdown', reply_markup: kb },
    );
    return;
  }

  if (data.startsWith('admin:delprod:')) {
    deleteProduct(Number(data.split(':')[2]));
    await ctx.answerCallbackQuery('Deleted.');
    await ctx.editMessageText('📦 *Products*:', {
      parse_mode: 'Markdown',
      reply_markup: adminProductsKeyboard(getAllProducts()),
    });
    return;
  }

  if (data === 'admin:addkeys' || data.startsWith('admin:addkeysfor:')) {
    const prodId = data.startsWith('admin:addkeysfor:') ? Number(data.split(':')[2]) : null;
    if (prodId) {
      adminState.set(adminId, { step: 'addkeys:keys', data: { product_id: prodId } });
      await ctx.answerCallbackQuery();
      await ctx.reply('🔑 Send keys one per line (or /cancel):');
    } else {
      const prods = getAllProducts().filter(p => p.active);
      const kb = new InlineKeyboard();
      for (const p of prods) kb.text(p.name, `admin:keysfor:${p.id}`).row();
      await ctx.answerCallbackQuery();
      await ctx.reply('📦 Which product?', { reply_markup: kb });
    }
    return;
  }

  if (data.startsWith('admin:keysfor:')) {
    adminState.set(adminId, { step: 'addkeys:keys', data: { product_id: Number(data.split(':')[2]) } });
    await ctx.answerCallbackQuery();
    await ctx.reply('🔑 Send keys one per line (or /cancel):');
    return;
  }

  await ctx.answerCallbackQuery();
}

export async function handleAdminText(ctx: Context): Promise<boolean> {
  const adminId = ctx.from!.id;
  const state = adminState.get(adminId);
  if (!state) return false;
  const text = ctx.message?.text ?? '';

  if (text === '/cancel') {
    adminState.delete(adminId);
    await ctx.reply('❌ Cancelled.');
    return true;
  }

  switch (state.step) {
    case 'newcat:name':
      state.data.name = text;
      state.step = 'newcat:emoji';
      await ctx.reply('Enter an emoji for the category (e.g. 🎮):');
      break;

    case 'newcat:emoji': {
      const cat = createCategory(state.data.name as string, text);
      adminState.delete(adminId);
      await ctx.reply(`✅ Category "${cat.name}" ${cat.emoji} created!`);
      break;
    }

    case 'newprod:name':
      state.data.name = text;
      state.step = 'newprod:description';
      await ctx.reply('Enter product description:');
      break;

    case 'newprod:description':
      state.data.description = text;
      state.step = 'newprod:price_vnd';
      await ctx.reply('💳 Enter VND price (e.g. 99000 for 99,000₫).\nUSDT price will be auto-converted using the live Vietcombank rate:');
      break;

    case 'newprod:price_vnd': {
      const vnd = parseInt(text, 10);
      if (isNaN(vnd) || vnd < 0) { await ctx.reply('Invalid. Enter a non-negative integer:'); return true; }
      state.data.price_vnd = vnd;
      const usdtCents = vndToUsdtCents(vnd);
      state.step = 'newprod:stock';
      await ctx.reply(
        `💎 Auto-converted: *${formatPriceUsdt(usdtCents)}*  _(${currentRateLabel()})_\n\n` +
        `Enter stock quantity (-1 for unlimited):`,
        { parse_mode: 'Markdown' },
      );
      break;
    }

    case 'newprod:stock': {
      const stock = parseInt(text, 10);
      if (isNaN(stock)) { await ctx.reply('Invalid. Enter an integer (-1 for unlimited):'); return true; }
      const prod = createProduct(
        state.data.category_id as number,
        state.data.name as string,
        state.data.description as string,
        state.data.price_vnd as number,
        stock,
      );
      adminState.delete(adminId);
      await ctx.reply(
        `✅ Product *"${prod.name}"* created!\n` +
        `💳 ${formatPriceVnd(prod.price_vnd)}  →  💎 ${formatPriceUsdt(vndToUsdtCents(prod.price_vnd))}`,
        { parse_mode: 'Markdown' },
      );
      break;
    }

    case 'addkeys:keys': {
      const keys = text.split('\n').map(k => k.trim()).filter(Boolean);
      if (keys.length === 0) { await ctx.reply('No keys found. Try again or /cancel:'); return true; }
      addKeys(state.data.product_id as number, keys);
      adminState.delete(adminId);
      await ctx.reply(`✅ Added ${keys.length} key(s).`);
      break;
    }

    default:
      adminState.delete(adminId);
      return false;
  }

  return true;
}
