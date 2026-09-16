const COUPONS = {
  BEMVINDO10: { type: 'percent', value: 10, label: 'Boas-vindas: 10% de desconto' },
  MODA10: { type: 'percent', value: 10, label: 'MODA10: 10% de desconto' },
  PRIMEIRACOMPRA: { type: 'percent', value: 15, label: 'Primeira compra: 15% de desconto' },
  FRETEGRATIS: { type: 'freeshipping', value: 0, label: 'Frete grátis nesta compra' },
};

export function validateCoupon(code) {
  const key = (code || '').trim().toUpperCase();
  const found = COUPONS[key];
  if (!found) return null;
  return { code: key, ...found };
}

export function applyCouponToTotal(coupon, subtotal, shippingPrice) {
  if (!coupon) return { discount: 0, shippingDiscount: 0 };
  if (coupon.type === 'percent') {
    return { discount: round2(subtotal * (coupon.value / 100)), shippingDiscount: 0 };
  }
  if (coupon.type === 'freeshipping') {
    return { discount: 0, shippingDiscount: shippingPrice || 0 };
  }
  return { discount: 0, shippingDiscount: 0 };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
