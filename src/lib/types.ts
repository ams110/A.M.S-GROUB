export type Category = {
  id: string;
  slug: string;
  name_he: string;
  sort: number;
  image_url: string | null;
};

export type Product = {
  id: string;
  category_id: string | null;
  slug: string;
  name_he: string;
  short_desc_he: string | null;
  description_he: string | null;
  image_url: string | null;
  datasheet_url: string | null;
  specs: Record<string, unknown>;
  is_featured: boolean;
  sort: number;
  sku: string | null;
  price: number;
  currency: string;
  stock: number;
  min_order_qty: number;
  is_orderable: boolean;
};

export type Profile = {
  id: string;
  role: "dealer" | "admin";
  status: "pending" | "approved" | "rejected";
  full_name: string | null;
  phone: string | null;
  company: string | null;
  city: string | null;
  address: string | null;
  created_at: string;
};

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "paid"
  | "shipped"
  | "delivered"
  | "cancelled";

export type PaymentMethod = "card" | "bank_transfer" | "cod";
export type PaymentStatus = "unpaid" | "paid" | "refunded";

export type Order = {
  id: string;
  order_number: string;
  dealer_id: string;
  status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  currency: string;
  subtotal: number;
  total: number;
  ship_name: string | null;
  ship_phone: string | null;
  ship_city: string | null;
  ship_address: string | null;
  notes: string | null;
  created_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  name_he: string;
  sku: string | null;
  unit_price: number;
  qty: number;
  line_total: number;
};
