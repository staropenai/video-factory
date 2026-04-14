/**
 * hooks/useStreamQuery.ts — V12 SSE streaming hook.
 *
 * Handles both response types from /api/router/stream:
 *   - JSON (Tier A/B): content arrives in a single JSON payload
 *   - SSE  (Tier C):   tokens arrive incrementally as data: events
 *
 * State machine: idle → thinking → streaming → done | error
 */

"use client";

import { useState, useCallback, useRef } from "react";

export interface StreamState {
  /** Accumulated answer text */
  content: string;
  /** True while waiting for the first token */
  isThinking: boolean;
  /** True once all tokens have arrived (or JSON fast-path completed) */
  isDone: boolean;
  /** Non-null on error */
  error: string | null;
  /** Which tier answered: "A", "B", "C", "CACHE", "L6", or null */
  tier: string | null;
  /** Source metadata from the response */
  sources: Array<{ id: string; title: string; type: string }>;
}

const INITIAL_STATE: StreamState = {
  content: "",
  isThinking: false,
  isDone: false,
  error: null,
  tier: null,
  sources: [],
};

export function useStreamQuery() {
  const [state, setState] = useState<StreamState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState(INITIAL_STATE);
  }, []);

  const query = useCallback(
    async (
      text: string,
      opts?: { sessionToken?: string; locale?: string; endpoint?: string }
    ) => {
      // Abort any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setState({ ...INITIAL_STATE, isThinking: true });

      // V4 spec: blur active element on thinking start to dismiss mobile keyboard
      try {
        (document.activeElement as HTMLElement)?.blur();
      } catch {
        // Not critical
      }

      // V5 T2: Client-side TTFT measurement (independent of server timestamp)
      const clientStart = Date.now();

      let response: Response;
      try {
        // V5 T4: Generate a unique idempotency key per query attempt
        const idempotencyKey = crypto.randomUUID();
        response = await fetch(opts?.endpoint ?? "/api/router/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-idempotency-key": idempotencyKey,
          },
          body: JSON.stringify({
            message: text,
            sessionToken: opts?.sessionToken,
          }),
          signal: controller.signal,
        });
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setState((s) => ({
          ...s,
          isThinking: false,
          error: "Network error",
          isDone: true,
        }));
        return;
      }

      const contentType = response.headers.get("content-type") || "";

      // ── JSON fast path (Tier A/B, escalation, errors) ───────────────
      if (contentType.includes("application/json")) {
        const data = await response.json();
        if (!response.ok || data.error) {
          setState((s) => ({
            ...s,
            isThinking: false,
            error: data.error || "Server error",
            isDone: true,
          }));
          return;
        }
        setState({
          // /api/router/stream returns `content`, /api/router returns `answer`
          content: data.content ?? data.answer ?? "",
          isThinking: false,
          isDone: true,
          error: null,
          tier: data.tier ?? null,
          sources: data.sources ?? [],
        });
        return;
      }

      // ── SSE stream (Tier C) ─────────────────────────────────────────
      if (!response.body) {
        setState((s) => ({
          ...s,
          isThinking: false,
          error: "No response body",
          isDone: true,
        }));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE frames (delimited by \n\n)
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? ""; // Keep incomplete frame in buffer

          for (const frame of frames) {
            const line = frame.trim();
            if (!line.startsWith("data: ")) continue;

            let event: Record<string, unknown>;
            try {
              event = JSON.parse(line.slice(6));
            } catch {
              continue;
            }

            switch (event.type) {
              case "thinking":
                setState((s) => ({ ...s, isThinking: true }));
                break;

              case "token":
                if (typeof event.text === "string") {
                  setState((s) => {
                    // V5 T2: Report client-side TTFT on first token
                    if (!s.content && typeof window !== "undefined" && process.env.NEXT_PUBLIC_SENTRY_DSN) {
                      const clientTtft = Date.now() - clientStart;
                      import("@sentry/nextjs").then((Sentry) => {
                        Sentry.setMeasurement("client_ttft_ms", clientTtft, "millisecond");
                      }).catch(() => { /* Sentry not loaded */ });
                    }
                    return {
                      ...s,
                      isThinking: false,
                      content: s.content + event.text,
                    };
                  });
                }
                break;

              case "done":
                setState((s) => ({
                  ...s,
                  isThinking: false,
                  isDone: true,
                  tier: (event.tier as string) ?? s.tier,
                  sources: (event.sources as StreamState["sources"]) ?? s.sources,
                }));
                break;

              case "error":
                setState((s) => ({
                  ...s,
                  isThinking: false,
                  error: (event.message as string) ?? "Error",
                  isDone: true,
                }));
                break;
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setState((s) => ({
          ...s,
          isThinking: false,
          error: "Connection lost",
          isDone: true,
        }));
      }

      // Ensure we mark as done even if the stream ends without a "done" event
      setState((s) => (s.isDone ? s : { ...s, isDone: true }));
    },
    []
  );

  return { ...state, query, reset };
}
