import { config } from 'dotenv';

config();

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const BOT_TOKEN = required('BOT_TOKEN');
export const BOT_USERNAME = process.env.BOT_USERNAME ?? '';
export const DB_PATH = process.env.DB_PATH ?? './shop.db';
export const ADMIN_IDS = (process.env.ADMIN_IDS ?? '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)
  .map(Number);

// SePay PG — Vietnamese VND hosted checkout
export const SEPAY_MERCHANT_ID = process.env.SEPAY_MERCHANT_ID ?? '';
export const SEPAY_SECRET_KEY = process.env.SEPAY_SECRET_KEY ?? '';
export const SEPAY_PG_ENV = (process.env.SEPAY_PG_ENV ?? 'sandbox') as 'sandbox' | 'production';

// NTPAY — USDT crypto payment
export const NTPAY_BASE_URL = (process.env.NTPAY_BASE_URL ?? '').replace(/\/$/, '');
export const NTPAY_MERCHANT_ID = process.env.NTPAY_MERCHANT_ID ?? '';
export const NTPAY_API_KEY = process.env.NTPAY_API_KEY ?? '';

// Public server URL (for IPN/callback endpoints and the SePay redirect page)
export const SERVER_URL = (process.env.SERVER_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export const WEBHOOK_PORT = Number(process.env.WEBHOOK_PORT ?? '3000');

// 1 USD = N VND — used to auto-convert VND prices to USDT
export const VND_TO_USD_RATE = Number(process.env.VND_TO_USD_RATE ?? '25000');
export const ORDER_PREFIX = process.env.ORDER_PREFIX ?? 'ORDER';
export const ORDER_EXPIRE_MINUTES = Number(process.env.ORDER_EXPIRE_MINUTES ?? '30');
