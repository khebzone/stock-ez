import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { API_TAG_TYPES, baseApi } from '../store/api/baseApi';
import { CLIENT_ID } from '../utils/clientId';

/**
 * Listens for "something changed" from the server and refetches whatever is on screen, so two
 * people working in the same company see each other's changes immediately. Only the queries a
 * screen is actually using are refetched. The stream carries no data, just the signal.
 */
export const useRealtimeSync = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    let stopped = false;
    let controller = new AbortController();
    let retryMs = 1000;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    let connectedBefore = false;

    const refresh = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        dispatch(baseApi.util.invalidateTags([...API_TAG_TYPES]));
      }, 400);
    };

    const handleBlock = (block: string) => {
      let event = 'message';
      let data = '';
      block.split('\n').forEach((line) => {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data = line.slice(5).trim();
      });
      if (event === 'change' && data !== CLIENT_ID) refresh();
    };

    const scheduleReconnect = () => {
      if (stopped) return;
      retryTimer = setTimeout(connect, retryMs);
      retryMs = Math.min(retryMs * 2, 30000);
    };

    const connect = async () => {
      if (stopped) return;
      const token = localStorage.getItem('token');
      const tenantId = localStorage.getItem('tenantId');
      if (!token || !tenantId) { scheduleReconnect(); return; }

      controller = new AbortController();
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/v1/events/stream`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Tenant-Id': tenantId,
            'X-User-Id': localStorage.getItem('userId') || '',
            'X-Client-Id': CLIENT_ID,
            Accept: 'text/event-stream',
          },
          signal: controller.signal,
        });
        if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);

        retryMs = 1000;
        // After a drop, changes may have happened that we never heard about — catch up once.
        if (connectedBefore) refresh();
        connectedBefore = true;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!stopped) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buffer.indexOf('\n\n')) >= 0) {
            handleBlock(buffer.slice(0, idx));
            buffer = buffer.slice(idx + 2);
          }
        }
      } catch {
        // dropped or aborted — fall through to the reconnect below
      }
      scheduleReconnect();
    };

    // A hidden tab is throttled by the browser, so catch up as soon as it is visible again.
    const onVisible = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', onVisible);

    connect();

    return () => {
      stopped = true;
      controller.abort();
      clearTimeout(retryTimer);
      clearTimeout(debounceTimer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [dispatch]);
};
