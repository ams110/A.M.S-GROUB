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
  reorder_point: number;
  min_order_qty: number;
  is_orderable: boolean;
};

export type CustomerType = "dealer" | "contractor";

export type Profile = {
  id: string;
  role: "dealer" | "admin";
  customer_type: CustomerType;
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

// ---- Warehouse module ----

export type StockReason = "purchase" | "sale" | "adjustment" | "return" | "initial";

export type StockMovement = {
  id: string;
  product_id: string;
  warehouse_id: string | null;
  delta: number;
  reason: StockReason;
  note: string | null;
  reference: string | null;
  unit_cost: number | null;
  balance_after: number | null;
  created_by: string | null;
  created_at: string;
};

export type Supplier = {
  id: string;
  name: string;
  contact: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
};

export type PurchaseOrderStatus = "draft" | "ordered" | "received" | "cancelled";

export type PurchaseOrder = {
  id: string;
  po_number: string | null;
  supplier_id: string | null;
  status: PurchaseOrderStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  received_at: string | null;
};

export type PurchaseOrderItem = {
  id: string;
  po_id: string;
  product_id: string;
  qty: number;
  unit_cost: number;
};
