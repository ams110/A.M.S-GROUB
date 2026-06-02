export function formatPrice(value: number, currency = "ILS") {
  try {
    return new Intl.NumberFormat("he-IL", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

export const ORDER_STATUS_HE: Record<string, string> = {
  pending: "ממתין לאישור",
  confirmed: "אושר",
  paid: "שולם",
  shipped: "נשלח",
  delivered: "נמסר",
  cancelled: "בוטל",
};

export const PAYMENT_METHOD_HE: Record<string, string> = {
  card: "כרטיס אשראי",
  bank_transfer: "העברה בנקאית",
  cod: "מזומן במסירה",
};

export const PAYMENT_STATUS_HE: Record<string, string> = {
  unpaid: "לא שולם",
  paid: "שולם",
  refunded: "הוחזר",
};

export const PROFILE_STATUS_HE: Record<string, string> = {
  pending: "ממתין לאישור",
  approved: "מאושר",
  rejected: "נדחה",
};

export const CUSTOMER_TYPE_HE: Record<string, string> = {
  dealer: "סוחר",
  contractor: "קבלן",
};

export const PAYMENT_TERMS_HE: Record<string, string> = {
  immediate: "מיידי",
  net30: "שוטף +30",
  net60: "שוטף +60",
};

export const STOCK_REASON_HE: Record<string, string> = {
  purchase: "קליטת רכש",
  sale: "מכירה",
  adjustment: "תיקון מלאי",
  return: "החזרה",
  initial: "מלאי פתיחה",
};

export const PO_STATUS_HE: Record<string, string> = {
  draft: "טיוטה",
  ordered: "הוזמן",
  received: "נקלט",
  cancelled: "בוטל",
};

export const QUOTE_STATUS_HE: Record<string, string> = {
  draft: "טיוטה",
  sent: "נשלחה",
  accepted: "אושרה",
  rejected: "נדחתה",
  expired: "פגה",
  converted: "הומרה להזמנה",
};
