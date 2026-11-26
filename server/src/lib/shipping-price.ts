export function calculateShippingPrice(rateType: string, flatRate: number, perKgRate: number, weightKg: number): number {
  const price = rateType === 'FLAT' ? flatRate : flatRate + perKgRate * weightKg;
  return Math.round((price + Number.EPSILON) * 100) / 100;
}

export function calculateCheckoutShippingPrice(rateType: string, flatRate: number, perKgRate: number, weightKg: number, courierQuoteRequired: boolean): number {
  return courierQuoteRequired ? 0 : calculateShippingPrice(rateType, flatRate, perKgRate, weightKg);
}
