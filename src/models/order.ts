import { db } from '../database/index.js';
import { ORDER_EXPIRE_MINUTES } from '../config.js';
import type { Order, OrderItem, PaymentMethod } from './types.js';

function expiredAt(): string {
  const d = new Date(Date.now() + ORDER_EXPIRE_MINUTES * 60 * 1000);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

export function createOrder(
  userId: number,
  paymentMethod: PaymentMethod,
  totalVnd: number,
  totalUsdt: number,
): Order {
  const result = db.run(
    `INSERT INTO orders (user_id, payment_method, total_vnd, total_usdt, expired_at)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, paymentMethod, totalVnd, totalUsdt, expiredAt()],
  );
  return getOrderById(Number(result.lastInsertRowid))!;
}

export function getOrderById(id: number): Order | undefined {
  return db.query<Order, [number]>('SELECT * FROM orders WHERE id = ?').get(id) ?? undefined;
}

export function getUserOrders(userId: number): Order[] {
  return db
    .query<Order, [number]>('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId);
}

export function getAllOrders(limit = 50): Order[] {
  return db
    .query<Order, [number]>('SELECT * FROM orders ORDER BY created_at DESC LIMIT ?')
    .all(limit);
}

export function addOrderItem(
  orderId: number,
  productId: number,
  quantity: number,
  priceVnd: number,
  priceUsdt: number,
): void {
  db.run(
    'INSERT INTO order_items (order_id, product_id, quantity, price_vnd, price_usdt) VALUES (?, ?, ?, ?, ?)',
    [orderId, productId, quantity, priceVnd, priceUsdt],
  );
}

export function getOrderItems(orderId: number): OrderItem[] {
  return db
    .query<OrderItem, [number]>(
      `SELECT oi.*, p.name
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ?`,
    )
    .all(orderId);
}

export function updateOrderStatus(
  orderId: number,
  status: Order['status'],
  paymentRef?: string,
): void {
  db.run(
    `UPDATE orders
     SET status = ?, payment_ref = COALESCE(?, payment_ref), updated_at = datetime('now')
     WHERE id = ?`,
    [status, paymentRef ?? null, orderId],
  );
}

// Sets payment_ref (NTPAY trans_id or other ref) without changing status
export function setOrderPaymentRef(orderId: number, ref: string): void {
  db.run(`UPDATE orders SET payment_ref = ? WHERE id = ?`, [ref, orderId]);
}

export function confirmOrderPayment(orderId: number, paymentRef: string): Order | null {
  const order = getOrderById(orderId);
  if (!order || order.status !== 'pending') return null;
  if (order.expired_at && new Date(order.expired_at) < new Date()) {
    db.run(`UPDATE orders SET status = 'expired', updated_at = datetime('now') WHERE id = ?`, [orderId]);
    return null;
  }
  db.run(
    `UPDATE orders
     SET status = 'paid', paid_at = datetime('now'), payment_ref = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [paymentRef, orderId],
  );
  return getOrderById(orderId) ?? null;
}

export function cleanupExpiredOrders(): number {
  const result = db.run(
    `UPDATE orders SET status = 'expired', updated_at = datetime('now')
     WHERE status = 'pending' AND expired_at < datetime('now')`,
  );
  return result.changes;
}
