import { db } from '../database/index.js';
import type { Category, Product, ProductKey } from './types.js';

// ---------- Categories ----------

export function getCategories(): Category[] {
  return db.query<Category, []>('SELECT * FROM categories ORDER BY id').all();
}

export function getCategoryById(id: number): Category | undefined {
  return db.query<Category, [number]>('SELECT * FROM categories WHERE id = ?').get(id) ?? undefined;
}

export function createCategory(name: string, emoji: string): Category {
  const result = db.run('INSERT INTO categories (name, emoji) VALUES (?, ?)', [name, emoji]);
  return { id: Number(result.lastInsertRowid), name, emoji };
}

export function deleteCategory(id: number): void {
  db.run('DELETE FROM categories WHERE id = ?', [id]);
}

// ---------- Products ----------

export function getProductsByCategory(categoryId: number): Product[] {
  return db
    .query<Product, [number]>(
      'SELECT * FROM products WHERE category_id = ? AND active = 1 ORDER BY id',
    )
    .all(categoryId);
}

export function getProductById(id: number): Product | undefined {
  return db.query<Product, [number]>('SELECT * FROM products WHERE id = ?').get(id) ?? undefined;
}

export function getAllProducts(): Product[] {
  return db.query<Product, []>('SELECT * FROM products ORDER BY id').all();
}

export function createProduct(
  categoryId: number,
  name: string,
  description: string,
  priceVnd: number,
  stock: number,
): Product {
  const result = db.run(
    'INSERT INTO products (category_id, name, description, price_vnd, stock) VALUES (?, ?, ?, ?, ?)',
    [categoryId, name, description, priceVnd, stock],
  );
  return getProductById(Number(result.lastInsertRowid))!;
}

export function updateProduct(
  id: number,
  fields: Partial<Pick<Product, 'name' | 'description' | 'price_vnd' | 'stock' | 'active'>>,
): void {
  const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  db.run(`UPDATE products SET ${sets} WHERE id = ?`, [...Object.values(fields), id]);
}

export function deleteProduct(id: number): void {
  db.run('DELETE FROM products WHERE id = ?', [id]);
}

// ---------- Product Keys ----------

export function addKeys(productId: number, keys: string[]): void {
  const insert = db.prepare('INSERT INTO product_keys (product_id, key_value) VALUES (?, ?)');
  for (const k of keys) insert.run(productId, k);
}

export function getAvailableKey(productId: number): ProductKey | undefined {
  return (
    db
      .query<ProductKey, [number]>(
        'SELECT * FROM product_keys WHERE product_id = ? AND used = 0 LIMIT 1',
      )
      .get(productId) ?? undefined
  );
}

export function markKeyUsed(keyId: number, orderId: number): void {
  db.run('UPDATE product_keys SET used = 1, order_id = ? WHERE id = ?', [orderId, keyId]);
}

export function countAvailableKeys(productId: number): number {
  return (
    db
      .query<{ n: number }, [number]>(
        'SELECT COUNT(*) as n FROM product_keys WHERE product_id = ? AND used = 0',
      )
      .get(productId)?.n ?? 0
  );
}
