import { VND_TO_USD_RATE } from '../config.js';

const VCB_URL =
  'https://portal.vietcombank.com.vn/Usercontrols/TVPortal.TyGia/pXML.aspx';

// VCB enforces max 1 request per 5 minutes — refresh every 6 min to stay safe
const REFRESH_INTERVAL_MS = 6 * 60 * 1000;

let cachedRate: number = VND_TO_USD_RATE;
let lastFetchedAt = 0;

export function getCachedRate(): number {
  return cachedRate;
}

async function fetchRate(): Promise<void> {
  try {
    const res = await fetch(VCB_URL, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();

    // <Exrate CurrencyCode="USD" CurrencyName="US DOLLAR" Buy="26,092.00" Transfer="26,122.00" Sell="26,412.00" />
    const match = xml.match(/CurrencyCode="USD"[^/]*?Sell="([\d,]+(?:\.\d+)?)"/i);
    if (!match) throw new Error('USD row not found');

    const rate = parseFloat(match[1].replace(/,/g, ''));
    if (!isFinite(rate) || rate < 1000) throw new Error(`Unexpected rate value: ${rate}`);

    cachedRate = rate;
    lastFetchedAt = Date.now();
    console.log(`[ExchangeRate] VCB USD sell = ${rate.toLocaleString('vi-VN')} VND`);
  } catch (err) {
    console.warn(`[ExchangeRate] Fetch failed: ${(err as Error).message}. Using cached: ${cachedRate.toLocaleString('vi-VN')}`);
  }
}

/** Fetch immediately then refresh every 6 minutes. Call once at startup. */
export async function startRateRefresher(): Promise<void> {
  await fetchRate();
  setInterval(fetchRate, REFRESH_INTERVAL_MS);
}

/** Convert VND → USDT cents using the current in-memory rate (sync). */
export function vndToUsdtCents(vnd: number): number {
  return Math.round((vnd / cachedRate) * 100);
}
