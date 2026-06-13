import { db } from '../database/index.js';
import type { CartItem } from './types.js';
import { vndToUsdtCents } from '../services/exchangeRate.js';

export function getCart(userId: number): CartItem[] {
  return db
    .query<CartItem, [number]>(
      `SELECT ci.*, p.name, p.price_vnd, p.stock
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       WHERE ci.user_id = ?`,
    )
    .all(userId);
}

export function addToCart(userId: number, productId: number, quantity = 1): void {
  db.run(
    `INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)
     ON CONFLICT(user_id, product_id) DO UPDATE SET quantity = quantity + excluded.quantity`,
    [userId, productId, quantity],
  );
}

export function removeFromCart(userId: number, productId: number): void {
  db.run('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?', [userId, productId]);
}

export function clearCart(userId: number): void {
  db.run('DELETE FROM cart_items WHERE user_id = ?', [userId]);
}

export function cartTotalVnd(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + (i.price_vnd ?? 0) * i.quantity, 0);
}

/** Compute USDT total using the current in-memory exchange rate (sync). */
export function cartTotalUsdtCents(items: CartItem[]): number {
  return vndToUsdtCents(cartTotalVnd(items));
}
