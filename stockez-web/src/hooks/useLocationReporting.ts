import { useEffect, useRef } from 'react';
import { useGetTrackingSettingsQuery, useSendPingMutation } from '../store/api/trackingApi';
import { clearGeoFix, getGeoFix, metersBetween, setGeoFix } from '../utils/geoPosition';

/**
 * Reports the field staff member's position while the app is on screen.
 *
 * A browser cannot report from the background — Android freezes the page the moment the phone is
 * locked or another app comes forward, and no permission changes that. So this reports while the
 * app is visible and stops cleanly when it is not, rather than pretending to a coverage it cannot
 * deliver. The gap is covered differently: every order, collection and delivery carries its own
 * position, so each shop still gets a verified stamp even if the trail between shops is missing.
 */

/** Below this, a new fix is the same spot seen through GPS jitter and not worth a row. */
const MIN_MOVE_METERS = 25;

/** Fixes worse than this are too vague to say anything about which shop he is at. */
const MAX_ACCURACY_METERS = 200;

export const useLocationReporting = (enabled: boolean) => {
  const { data } = useGetTrackingSettingsQuery(undefined, { skip: !enabled });
  const [sendPing] = useSendPingMutation();

  const settings = data?.data;
  const trackingOn = Boolean(enabled && settings?.locationTrackingEnabled);
  const intervalMs = (settings?.locationPingIntervalSeconds ?? 90) * 1000;

  const lastSentAt = useRef(0);
  const lastSentAtPos = useRef<{ lat: number; lng: number } | null>(null);
  const stopped = useRef(false);

  useEffect(() => {
    if (!trackingOn || !('geolocation' in navigator)) return;

    stopped.current = false;
    let watchId: number | null = null;

    const onPosition = (pos: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = pos.coords;
      if (accuracy != null && accuracy > MAX_ACCURACY_METERS) return;

      setGeoFix({ latitude, longitude, accuracyM: accuracy ?? undefined });

      const now = Date.now();
      const moved = lastSentAtPos.current
        ? metersBetween(lastSentAtPos.current.lat, lastSentAtPos.current.lng, latitude, longitude)
        : Infinity;
      const dueByTime = now - lastSentAt.current >= intervalMs;

      // Either he has moved somewhere new, or enough time has passed that a fresh "still here"
      // is worth recording. Both conditions exist so a parked phone does not write a row a
      // minute, and a moving one is not under-reported.
      if (moved < MIN_MOVE_METERS && !dueByTime) return;
      if (now - lastSentAt.current < 15000) return;

      lastSentAt.current = now;
      lastSentAtPos.current = { lat: latitude, lng: longitude };

      sendPing({ latitude, longitude, accuracyM: accuracy ?? undefined })
        .unwrap()
        .then((res) => {
          // Only a disabled tenant is a settled answer worth giving up on. NOT_CHECKED_IN is
          // temporary — the staff member may check in minutes later, and stopping here would
          // leave them unreported for the rest of the shift until they reloaded the page.
          if (res?.data?.reason === 'TRACKING_DISABLED') {
            stopped.current = true;
            if (watchId !== null) navigator.geolocation.clearWatch(watchId);
          }
        })
        .catch(() => {
          // Offline or a server hiccup: keep the local fix so the next bill still carries a
          // position, and try again on the next movement.
        });
    };

    const onError = (err: GeolocationPositionError) => {
      clearGeoFix();
      if (err.code === err.PERMISSION_DENIED) {
        stopped.current = true;
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      }
    };

    const start = () => {
      if (stopped.current || watchId !== null) return;
      watchId = navigator.geolocation.watchPosition(onPosition, onError, {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 30000,
      });
    };

    const stop = () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
    };

    // Releasing the watch while hidden saves the battery that a frozen page would waste anyway.
    const onVisibility = () => (document.hidden ? stop() : start());

    start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
      clearGeoFix();
    };
  }, [trackingOn, intervalMs, sendPing]);

  return {
    trackingOn,
    hasFix: Boolean(getGeoFix()),
  };
};
