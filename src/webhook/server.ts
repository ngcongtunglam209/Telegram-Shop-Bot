import type { Bot, Context } from 'grammy';
import { SePayPgClient } from 'sepay-pg-node';
import {
  BOT_USERNAME,
  NTPAY_API_KEY,
  NTPAY_MERCHANT_ID,
  SEPAY_MERCHANT_ID,
  SEPAY_PG_ENV,
  SEPAY_SECRET_KEY,
  SERVER_URL,
  WEBHOOK_PORT,
} from '../config.js';
import { getOrderById } from '../models/order.js';
import { deliverOrder } from '../handlers/payment.js';

// ---------------------------------------------------------------------------
// SePay PG client
// ---------------------------------------------------------------------------

const sepayClient = new SePayPgClient({
  env: SEPAY_PG_ENV,
  merchant_id: SEPAY_MERCHANT_ID,
  secret_key: SEPAY_SECRET_KEY,
});

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

function checkoutPage(checkoutUrl: string, fields: Record<string, unknown>): string {
  const inputs = Object.entries(fields)
    .map(([name, value]) => `<input type="hidden" name="${name}" value="${esc(String(value))}">`)
    .join('\n    ');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Redirecting to payment…</title>
  <style>
    body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;
         min-height:100vh;margin:0;background:#f5f5f5}
    .card{background:#fff;border-radius:12px;padding:40px;text-align:center;
          box-shadow:0 2px 16px rgba(0,0,0,.1);max-width:380px;width:90%}
    .spinner{width:48px;height:48px;border:4px solid #eee;border-top-color:#0088cc;
             border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 20px}
    @keyframes spin{to{transform:rotate(360deg)}}
    p{color:#555;margin:0}
  </style>
</head>
<body>
  <div class="card"><div class="spinner"></div><p>Redirecting to SePay checkout…</p></div>
  <form id="f" action="${esc(checkoutUrl)}" method="POST">${inputs}</form>
  <script>document.getElementById('f').submit();</script>
</body></html>`;
}

function resultPage(title: string, message: string, icon: string): string {
  const tgLink = BOT_USERNAME ? `https://t.me/${BOT_USERNAME}` : null;
  const btn = tgLink ? `<a class="btn" href="${tgLink}">↩ Return to Telegram</a>` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(title)}</title>
  <style>
    body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;
         min-height:100vh;margin:0;background:#f5f5f5}
    .card{background:#fff;border-radius:12px;padding:40px;text-align:center;
          box-shadow:0 2px 16px rgba(0,0,0,.1);max-width:380px;width:90%}
    .icon{font-size:56px;margin-bottom:16px}
    h1{font-size:22px;margin:0 0 8px}
    p{color:#555;margin:0 0 24px}
    .btn{display:inline-block;background:#0088cc;color:#fff;text-decoration:none;
         padding:12px 28px;border-radius:8px;font-weight:600}
    .btn:hover{background:#006fa8}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${esc(title)}</h1>
    <p>${esc(message)}</p>
    ${btn}
  </div>
</body></html>`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function json(data: object, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function html(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// ---------------------------------------------------------------------------
// SePay IPN handler (JSON POST from SePay gateway)
// ---------------------------------------------------------------------------

interface SePayIpnBody {
  notification_type?: string;
  order?: { order_invoice_number?: string; order_status?: string; order_amount?: number };
  transaction?: { id?: string | number };
}

async function handleSePayIpn(body: SePayIpnBody, bot: Bot<Context>): Promise<Response> {
  const type = body.notification_type ?? '';
  const orderStatus = body.order?.order_status ?? '';
  const invoiceNumber = body.order?.order_invoice_number ?? '';
  const amount = body.order?.order_amount ?? 0;
  const txnId = String(body.transaction?.id ?? '');

  console.log(`[SePay IPN] type=${type} status=${orderStatus} invoice=${invoiceNumber}`);

  const isPaid =
    ['ORDER_PAID', 'PAYMENT_SUCCESS'].includes(type) &&
    ['CAPTURED', 'COMPLETED', 'PAID'].includes(orderStatus);

  if (!isPaid) return json({ success: true, message: 'ignored' });

  const orderId = Number(invoiceNumber);
  const order = getOrderById(orderId);
  if (!order) return json({ success: false, message: 'order_not_found' });
  if (order.payment_method !== 'sepay') return json({ success: false, message: 'wrong_method' });
  if (order.status !== 'pending') return json({ success: true, message: 'already_processed' });
  if (amount < order.total_vnd) return json({ success: false, message: 'underpaid' });

  await deliverOrder(
    async text => { await bot.api.sendMessage(order.user_id, text, { parse_mode: 'Markdown' }); },
    order.id,
    txnId,
    order.payment_method === 'sepay' ? 'vi' : 'en',
  );

  console.info(`[SePay IPN] Order #${order.id} delivered to user ${order.user_id}`);
  return json({ success: true });
}

// ---------------------------------------------------------------------------
// NTPAY callback handler (form POST from NTPAY)
// ---------------------------------------------------------------------------

async function handleNtpayCallback(req: Request, bot: Bot<Context>): Promise<Response> {
  let form: URLSearchParams;
  try {
    const text = await req.text();
    form = new URLSearchParams(text);
  } catch {
    return json({ success: false }, 400);
  }

  const merchantId  = form.get('merchant_id') ?? '';
  const apiKey      = form.get('api_key') ?? '';
  const requestId   = form.get('request_id') ?? '';
  const transId     = form.get('trans_id') ?? '';
  const status      = form.get('status') ?? '';
  const received    = form.get('received') ?? '0';
  const txnHash     = form.get('transaction_id') ?? '';

  console.log(`[NTPAY] request_id=${requestId} trans_id=${transId} status=${status}`);

  // Verify credentials
  if (merchantId !== NTPAY_MERCHANT_ID || apiKey !== NTPAY_API_KEY) {
    console.warn('[NTPAY] Unauthorized callback');
    return new Response('Unauthorized', { status: 401 });
  }

  if (status === 'expired') {
    const orderId = Number(requestId);
    if (orderId) {
      const order = getOrderById(orderId);
      if (order?.status === 'pending') {
        const { updateOrderStatus } = await import('../models/order.js');
        updateOrderStatus(orderId, 'expired');
        await bot.api.sendMessage(
          order.user_id,
          `⌛ Your USDT payment for Order #${orderId} has expired. Use /start to place a new order.`,
        ).catch(() => {});
      }
    }
    return new Response('OK');
  }

  if (status !== 'completed') return new Response('OK');

  const orderId = Number(requestId);
  const order = getOrderById(orderId);
  if (!order) return new Response('OK');
  if (order.payment_method !== 'ntpay') return new Response('OK');
  if (order.status !== 'pending') return new Response('OK');

  const ref = txnHash || transId;
  await deliverOrder(
    async text => { await bot.api.sendMessage(order.user_id, text, { parse_mode: 'Markdown' }); },
    order.id,
    ref,
    'en',
  );

  console.info(`[NTPAY] Order #${order.id} delivered (received ${received} USDT)`);
  return new Response('OK');
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

export function startServer(bot: Bot<Context>): void {
  Bun.serve({
    port: WEBHOOK_PORT,
    async fetch(req) {
      const { pathname } = new URL(req.url);
      const method = req.method;

      // SePay redirect page — GET /checkout/:orderId
      const checkoutMatch = pathname.match(/^\/checkout\/(\d+)$/);
      if (checkoutMatch && method === 'GET') {
        const orderId = Number(checkoutMatch[1]);
        const order = getOrderById(orderId);
        if (!order || order.status !== 'pending' || order.payment_method !== 'sepay') {
          return html(resultPage('Link Invalid', 'This payment link is invalid or has already been used.', '❌'), 404);
        }
        const checkoutUrl = sepayClient.checkout.initCheckoutUrl();
        const fields = sepayClient.checkout.initOneTimePaymentFields({
          payment_method: 'BANK_TRANSFER',
          order_invoice_number: String(order.id),
          order_amount: order.total_vnd,
          currency: 'VND',
          order_description: `Order #${order.id} — Digital Shop`,
          success_url: `${SERVER_URL}/payment/success`,
          error_url: `${SERVER_URL}/payment/error`,
          cancel_url: `${SERVER_URL}/payment/cancel`,
        });
        return html(checkoutPage(checkoutUrl, fields as Record<string, unknown>));
      }

      // SePay IPN — POST /ipn/sepay
      if (pathname === '/ipn/sepay' && method === 'POST') {
        let body: SePayIpnBody;
        try { body = (await req.json()) as SePayIpnBody; }
        catch { return json({ success: false }, 400); }
        return handleSePayIpn(body, bot);
      }

      // NTPAY callback — POST /callback/ntpay
      if (pathname === '/callback/ntpay' && method === 'POST') {
        return handleNtpayCallback(req, bot);
      }

      // Result pages
      if (pathname === '/payment/success' && method === 'GET') {
        return html(resultPage('Payment Successful! 🎉', 'Your order has been received. Return to Telegram to get your items.', '✅'));
      }
      if (pathname === '/payment/cancel' && method === 'GET') {
        return html(resultPage('Payment Cancelled', 'You cancelled the payment. Return to Telegram to try again.', '↩️'));
      }
      if (pathname === '/payment/error' && method === 'GET') {
        return html(resultPage('Payment Failed', 'Something went wrong. Return to Telegram and try again.', '⚠️'));
      }

      return new Response('Not Found', { status: 404 });
    },
  });

  console.log(`Server listening on port ${WEBHOOK_PORT}`);
  console.log(`  SePay redirect : ${SERVER_URL}/checkout/:orderId`);
  console.log(`  SePay IPN      : ${SERVER_URL}/ipn/sepay`);
  console.log(`  NTPAY callback : ${SERVER_URL}/callback/ntpay`);
}
