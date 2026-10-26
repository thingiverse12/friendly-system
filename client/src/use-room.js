import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';

// Hämta rumstillstånd och reagera på realtids-signaler (samt polling som feltåligt reservläge).
// WS autentiseras med en kortlivad engångsbiljett (sessioncookien är HttpOnly).
export function useRoom(roomId) {
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);
  const debounceRef = useRef(null);

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

    async function connect() {
      if (closed) return;
      let ticket;
      try {
        const d = await api.get('/auth/ws-ticket');
        ticket = d.ticket;
      } catch {
        if (!closed) reconnectTimer = setTimeout(connect, 3000);
        return;
      }
      if (closed) return;
      const url = `${protocol}://${window.location.host}/ws?room=${encodeURIComponent(roomId)}&ticket=${encodeURIComponent(ticket)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'room.changed' || msg.type === 'presence') {
          clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => refresh(true), 350);
        }
      };
      ws.onclose = () => { if (!closed) reconnectTimer = setTimeout(connect, 2500); };
      ws.onerror = () => ws.close();
    }
    connect();
    const poll = setInterval(() => refresh(true), 20000);
    return () => {
      closed = true;
      clearInterval(poll);
      clearTimeout(reconnectTimer);
      clearTimeout(debounceRef.current);
      wsRef.current?.close();
    };
  }, [roomId, refresh]);

  return { state, error, refresh };
}
