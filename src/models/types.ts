export interface Category {
  id: number;
  name: string;
  emoji: string;
}

export interface Product {
  id: number;
  category_id: number;
  name: string;
  description: string;
  price_vnd: number;
  stock: number;
  active: number;
  created_at: string;
}

export interface ProductKey {
  id: number;
  product_id: number;
  key_value: string;
  used: number;
  order_id: number | null;
}

export interface User {
  id: number;
  username: string | null;
  first_name: string;
  language: 'en' | 'vi';
  created_at: string;
}

export interface CartItem {
  id: number;
  user_id: number;
  product_id: number;
  quantity: number;
  name?: string;
  price_vnd?: number;
  stock?: number;
}

export type PaymentMethod = 'sepay' | 'ntpay';

export interface Order {
  id: number;
  user_id: number;
  payment_method: PaymentMethod;
  total_vnd: number;
  total_usdt: number;
  status: 'pending' | 'paid' | 'delivered' | 'cancelled' | 'expired';
  payment_ref: string | null;
  expired_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  quantity: number;
  price_vnd: number;
  price_usdt: number;
  name?: string;
}
