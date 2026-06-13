import type { CallbackQueryContext, Context } from 'grammy';
import { getCategories, getCategoryById, getProductById, getProductsByCategory } from '../models/product.js';
import { addToCart } from '../models/cart.js';
import { t } from '../i18n/index.js';
import { getUserLocale } from '../models/user.js';
import { formatProductPrice } from '../utils/format.js';
import { categoryKeyboard, productDetailKeyboard, productListKeyboard } from '../utils/keyboards.js';

export async function handleShop(ctx: Context | CallbackQueryContext<Context>): Promise<void> {
  const locale = getUserLocale(ctx.from!.id);
  const categories = getCategories();
  const edit = !!ctx.callbackQuery;

  if (categories.length === 0) {
    const text = t(locale, 'shop_empty');
    if (edit) { await ctx.answerCallbackQuery(); await ctx.editMessageText(text); }
    else await (ctx as Context).reply(text);
    return;
  }

  const text = t(locale, 'shop_title');
  if (edit) {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: categoryKeyboard(categories) });
  } else {
    await (ctx as Context).reply(text, { parse_mode: 'Markdown', reply_markup: categoryKeyboard(categories) });
  }
}

export async function handleCategory(ctx: CallbackQueryContext<Context>): Promise<void> {
  const locale = getUserLocale(ctx.from!.id);
  const id = Number(ctx.callbackQuery.data.split(':')[1]);
  const category = getCategoryById(id);
  if (!category) { await ctx.answerCallbackQuery('Category not found.'); return; }
  const products = getProductsByCategory(id);
  const text = products.length === 0
    ? `${category.emoji} *${category.name}*\n\n${t(locale, 'category_empty')}`
    : `${category.emoji} *${category.name}*\n\n${t(locale, 'choose_product')}`;
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: productListKeyboard(products, id) });
}

export async function handleProductDetail(ctx: CallbackQueryContext<Context>): Promise<void> {
  const locale = getUserLocale(ctx.from!.id);
  const id = Number(ctx.callbackQuery.data.split(':')[1]);
  const product = getProductById(id);
  if (!product) { await ctx.answerCallbackQuery('Product not found.'); return; }

  const stockLabel =
    product.stock === -1 ? t(locale, 'stock_unlimited')
    : product.stock > 0  ? t(locale, 'stock_left', { n: product.stock })
    :                       t(locale, 'stock_out');

  const text =
    `*${product.name}*\n\n${product.description}\n\n` +
    `💰 ${t(locale, 'price_label')}: *${formatProductPrice(product.price_vnd, locale)}*\n` +
    `📦 ${stockLabel}`;

  await ctx.answerCallbackQuery();
  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    reply_markup: productDetailKeyboard(product.id, product.category_id, locale),
  });
}

export async function handleAddToCart(ctx: CallbackQueryContext<Context>): Promise<void> {
  const locale = getUserLocale(ctx.from!.id);
  const productId = Number(ctx.callbackQuery.data.split(':')[1]);
  const product = getProductById(productId);
  if (!product || !product.active) { await ctx.answerCallbackQuery(t(locale, 'unavailable')); return; }
  if (product.stock === 0) { await ctx.answerCallbackQuery(t(locale, 'out_of_stock')); return; }
  addToCart(ctx.from!.id, productId);
  await ctx.answerCallbackQuery(t(locale, 'added_to_cart', { name: product.name }));
}
