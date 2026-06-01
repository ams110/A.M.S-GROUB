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
