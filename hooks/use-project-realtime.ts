"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

export type RealtimeEvent = { type: string; projectId: string; taskId?: string; actorId?: string; at: string };

/**
 * Joins the project's room on the realtime server. The socket authenticates with a short-lived
 * token minted by /api/realtime/token (the session cookie is HttpOnly, so the browser cannot
 * read it); the server re-checks project access before letting the socket into the room.
 */
export function useProjectRealtime(projectId: string, onEvent: (event: RealtimeEvent) => void) {
  const handler = useRef(onEvent);
  const [connected, setConnected] = useState(false);

  // Keep the latest callback without re-subscribing the socket on every render.
  useEffect(() => {
    handler.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_REALTIME_URL;
    if (!url) return;
    let socket: Socket | undefined;
    let cancelled = false;

    (async () => {
      const res = await fetch("/api/realtime/token");
      if (!res.ok || cancelled) return;
      const { data } = (await res.json()) as { data: { token: string } };
      socket = io(url, { auth: { token: data.token }, transports: ["websocket", "polling"], reconnectionAttempts: 5 });
      socket.on("connect", () => socket?.emit("join", projectId));
      socket.on("joined", () => setConnected(true));
      socket.on("disconnect", () => setConnected(false));
      socket.on("event", (event: RealtimeEvent) => handler.current(event));
    })().catch(() => {
      /* realtime is optional; the page still works without it */
    });

    return () => {
      cancelled = true;
      socket?.disconnect();
      setConnected(false);
    };
  }, [projectId]);

  return { connected };
}
