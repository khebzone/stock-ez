export interface GeoFix {
  latitude: number;
  longitude: number;
  accuracyM?: number;
  at: number;
}

/**
 * Last known device position, held outside React so the API layer can attach it to every request
 * without each screen passing coordinates down through its payload.
 *
 * A fix is only handed out while it is fresh. Stamping a two-hour-old position onto a bill would
 * assert the salesman was at that shop when he was not — a stale fix is worse than none, so it is
 * dropped rather than reused.
 */
const MAX_FIX_AGE_MS = 5 * 60 * 1000;

let current: GeoFix | null = null;

export const setGeoFix = (fix: Omit<GeoFix, 'at'>) => {
  current = { ...fix, at: Date.now() };
};

export const clearGeoFix = () => {
  current = null;
};

export const getGeoFix = (): GeoFix | null => {
  if (!current) return null;
  if (Date.now() - current.at > MAX_FIX_AGE_MS) return null;
  return current;
};

export const metersBetween = (
  lat1: number, lng1: number, lat2: number, lng2: number,
): number => {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
