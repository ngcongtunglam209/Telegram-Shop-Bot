import type { Locale } from '../i18n/index.js';
import { vndToUsdtCents, getCachedRate } from '../services/exchangeRate.js';

export function formatPriceVnd(amount: number): string {
  return `${amount.toLocaleString('vi-VN')} ₫`;
}

export function formatPriceUsdt(cents: number): string {
  return `$${(cents / 100).toFixed(2)} USDT`;
}

/** Primary price for locale, secondary in parentheses. */
export function formatProductPrice(priceVnd: number, locale: Locale): string {
  const usdtCents = vndToUsdtCents(priceVnd);
  return locale === 'vi'
    ? `${formatPriceVnd(priceVnd)} *(≈ ${formatPriceUsdt(usdtCents)})*`
    : `${formatPriceUsdt(usdtCents)} *(≈ ${formatPriceVnd(priceVnd)})*`;
}

/** The "pay X" label for the checkout button. */
export function formatCheckoutAmount(priceVnd: number, locale: Locale): string {
  return locale === 'vi'
    ? formatPriceVnd(priceVnd)
    : formatPriceUsdt(vndToUsdtCents(priceVnd));
}

export function currentRateLabel(): string {
  return `1 USD = ${getCachedRate().toLocaleString('vi-VN')} ₫ (VCB)`;
}
