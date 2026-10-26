import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';

// Hämta rumstillstånd och reagera på realtids-signaler (samt polling som feltåligt reservläge).
// WS autentiseras med en kortlivad engångsbiljett (sessioncookien är HttpOnly).
// I serverless-miljöer (t.ex. Vercel) saknas beständiga WebSocket-servrar – då
// trappas klienten automatiskt ner till polling efter ett antal misslyckade försök.
const MAX_WS_ATTEMPTS = 6;

export function useRoom(roomId) {
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);
  const debounceRef = useRef(null);
  const pollOnlyRef = useRef(false);

  const refresh = useCallback(async (silent = false) => {
    try {
      const d = await api.get(`/rooms/${roomId}/state`);
      setState(d);
      setError(null);
    } catch (err) {
      if (!silent) setError(err.message);
    }
  }, [roomId]);

  useEffect(() => {
    refresh();
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    let closed = false;
    let reconnectTimer;
    let attempt = 0;

    async function connect() {
      if (closed || pollOnlyRef.current) return;
      let ticket;
      try {
        const d = await api.get('/auth/ws-ticket');
        ticket = d.ticket;
      } catch {
        scheduleReconnect();
        return;
      }
      if (closed) return;
      const url = `${protocol}://${window.location.host}/ws?room=${encodeURIComponent(roomId)}&ticket=${encodeURIComponent(ticket)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => { attempt = 0; };
      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'room.changed' || msg.type === 'presence') {
          clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => refresh(true), 350);
        }
      };
      ws.onclose = () => scheduleReconnect();
      ws.onerror = () => ws.close();
    }

    function scheduleReconnect() {
      if (closed || pollOnlyRef.current) return;
      attempt += 1;
      if (attempt >= MAX_WS_ATTEMPTS) {
        // Realtid saknas i den här miljön – polling räcker för spelets synkronisering.
        pollOnlyRef.current = true;
        return;
      }
      const delay = Math.min(1000 * 2 ** (attempt - 1), 30000);
      reconnectTimer = setTimeout(connect, delay);
    }

    connect();
    const poll = setInterval(() => refresh(true), 20000);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(true); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      closed = true;
      clearInterval(poll);
      clearTimeout(reconnectTimer);
      clearTimeout(debounceRef.current);
      document.removeEventListener('visibilitychange', onVisible);
      wsRef.current?.close();
    };
  }, [roomId, refresh]);

  return { state, error, refresh };
}
