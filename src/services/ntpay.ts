import { NTPAY_API_KEY, NTPAY_BASE_URL, NTPAY_MERCHANT_ID, SERVER_URL } from '../config.js';

interface AddInvoiceResponse {
  status: 'success' | 'error';
  msg: string;
  data?: {
    trans_id: string;
    request_id: string;
    amount: string;
    status: string;
    url_payment: string;
  };
}

interface InvoiceStatusResponse {
  status: 'success' | 'error';
  msg: string;
  data?: {
    trans_id: string;
    request_id: string;
    amount: string;
    received: string;
    status: 'waiting' | 'completed' | 'expired';
    from_address: string | null;
    transaction_id: string | null;
    create_gettime: string;
    update_gettime: string;
  };
}

export interface NtpayInvoice {
  transId: string;
  urlPayment: string;
  amount: string;
}

export async function createInvoice(
  orderId: number,
  amountUsdt: number,        // real USDT amount (e.g. 5.00)
  name: string,
  description: string,
): Promise<NtpayInvoice> {
  const params = new URLSearchParams({
    merchant_id: NTPAY_MERCHANT_ID,
    api_key: NTPAY_API_KEY,
    name,
    description,
    amount: amountUsdt.toFixed(2),
    request_id: String(orderId),
    callback_url: `${SERVER_URL}/callback/ntpay`,
    success_url: `${SERVER_URL}/payment/success`,
    cancel_url: `${SERVER_URL}/payment/cancel`,
  });

  const res = await fetch(`${NTPAY_BASE_URL}/api/AddInvoice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) throw new Error(`NTPAY HTTP ${res.status}`);

  const json = (await res.json()) as AddInvoiceResponse;
  if (json.status !== 'success' || !json.data) {
    throw new Error(`NTPAY error: ${json.msg}`);
  }

  return {
    transId: json.data.trans_id,
    urlPayment: json.data.url_payment,
    amount: json.data.amount,
  };
}

export async function getInvoiceStatus(transId: string): Promise<InvoiceStatusResponse['data'] | null> {
  const params = new URLSearchParams({
    merchant_id: NTPAY_MERCHANT_ID,
    api_key: NTPAY_API_KEY,
    trans_id: transId,
  });

  const res = await fetch(`${NTPAY_BASE_URL}/api/GetInvoiceStatus`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) return null;
  const json = (await res.json()) as InvoiceStatusResponse;
  return json.status === 'success' ? (json.data ?? null) : null;
}
