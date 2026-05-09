export function formatINR(amount: number | string | null | undefined): string {
  return '₹' + Number(amount ?? 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatINRCompact(amount: number | string | null | undefined): string {
  const n = Number(amount ?? 0);
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`;
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(2)}L`;
  if (n >= 1_000)      return `₹${(n / 1_000).toFixed(1)}K`;
  return formatINR(n);
}
