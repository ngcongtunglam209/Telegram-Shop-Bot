import { InlineKeyboard } from 'grammy';
import type { Category, Product } from '../models/types.js';
import type { Locale } from '../i18n/index.js';
import { t } from '../i18n/index.js';

export function categoryKeyboard(categories: Category[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const cat of categories) kb.text(`${cat.emoji} ${cat.name}`, `cat:${cat.id}`).row();
  kb.text('🛒 Cart', 'cart').text('📋 Orders', 'orders');
  return kb;
}

export function productListKeyboard(products: Product[], categoryId: number): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const p of products) kb.text(p.name, `product:${p.id}`).row();
  kb.text('⬅️ Back', 'shop');
  return kb;
}

export function productDetailKeyboard(productId: number, categoryId: number, locale: Locale): InlineKeyboard {
  return new InlineKeyboard()
    .text(t(locale, 'add_to_cart'), `addcart:${productId}`)
    .row()
    .text(t(locale, 'back_to_category'), `cat:${categoryId}`);
}

export function cartKeyboard(hasItems: boolean, locale: Locale): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (hasItems) {
    kb.text(t(locale, 'checkout'), 'checkout').row();
    kb.text(t(locale, 'clear_cart'), 'clearcart').row();
  }
  kb.text(t(locale, 'continue_shopping'), 'shop');
  return kb;
}

export function checkoutMethodKeyboard(
  locale: Locale,
  vndLabel: string,   // pre-formatted VND amount
  usdtLabel: string,  // pre-formatted USDT amount
  hasSepay: boolean,
  hasNtpay: boolean,
): InlineKeyboard {
  const kb = new InlineKeyboard();

  const addSepay = () => {
    if (hasSepay) kb.text(t(locale, 'pay_vnd', { amount: vndLabel }), 'pay_method:sepay').row();
  };
  const addNtpay = () => {
    if (hasNtpay) kb.text(t(locale, 'pay_usdt', { amount: usdtLabel }), 'pay_method:ntpay').row();
  };

  // Vietnamese → VND first; others → USDT first
  if (locale === 'vi') { addSepay(); addNtpay(); }
  else                  { addNtpay(); addSepay(); }

  kb.text(t(locale, 'back_to_cart'), 'cart');
  return kb;
}

// Admin keyboards (English only)
export function adminMainKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📂 Categories', 'admin:categories').row()
    .text('📦 Products', 'admin:products').row()
    .text('📋 Orders', 'admin:orders').row()
    .text('🔑 Add Keys', 'admin:addkeys');
}

export function adminCategoriesKeyboard(categories: Category[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const cat of categories) kb.text(`${cat.emoji} ${cat.name}`, `admin:delcat:${cat.id}`).row();
  kb.text('➕ Add Category', 'admin:newcat').row();
  kb.text('⬅️ Back', 'admin:main');
  return kb;
}

export function adminProductsKeyboard(products: Product[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const p of products) kb.text(`${p.active ? '✅' : '❌'} ${p.name}`, `admin:editprod:${p.id}`).row();
  kb.text('➕ Add Product', 'admin:newprod').row();
  kb.text('⬅️ Back', 'admin:main');
  return kb;
}
