export function getProductRates(product: any): { min: number | null; max: number | null } {
  const min = product?.fifoMinSaleRate ?? product?.minSaleRate ?? null;
  const max = product?.fifoMaxSaleRate ?? product?.maxSaleRate ?? null;
  return {
    min: min != null ? Number(min) : null,
    max: max != null ? Number(max) : null,
  };
}

export function isPriceOutOfRange(unitPrice: number, min: number | null, max: number | null): boolean {
  return (min != null && unitPrice < min) || (max != null && unitPrice > max);
}

export function defaultUnitPrice(min: number | null, max: number | null): number {
  return max ?? min ?? 0;
}
