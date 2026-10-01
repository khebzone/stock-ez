/**
 * Reads the tenant slug from the current hostname.
 * teddymart.stockez.in  → "teddymart"
 * stockez.in            → null  (super admin portal)
 * localhost             → null  (super admin in local dev)
 *
 * Local dev override: add ?tenant=teddymart to the URL to simulate a tenant subdomain.
 */
export function getTenantSlug(): string | null {
  const params = new URLSearchParams(window.location.search);
  const paramSlug = params.get('tenant');
  if (paramSlug) return paramSlug.split('/')[0].split('?')[0].trim() || null;

  const parts = window.location.hostname.split('.');
  const isIp = parts.length === 4 && parts.every(p => /^\d+$/.test(p));
  if (!isIp && parts.length >= 3 && parts[0] !== 'www') {
    return parts[0];
  }
  return null;
}

export function isSuperAdminPortal(): boolean {
  return getTenantSlug() === null;
}
