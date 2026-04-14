# JTG Latency Sprint — Claude Code Instructions

**Priority: P0 — blocks production**
**Goal: Reduce AI response from 5–7s to TTFT < 800ms**
**Constraint: Do not change V11 routing logic. Only change the output layer and supporting infrastructure.**

---

## Root Cause

The bottleneck is synchronous LLM API wait. Breakdown (estimates, verify with APM):

| Stage | Est. duration | Notes |
|-------|--------------|-------|
| Network RTT in | 50–200ms | |
| Tier A/B keyword match | 10–50ms | Should be fast; if >100ms, indexes are missing |
| pgvector lookup | 100–500ms | Slow on cold start without index |
| Redis cache check | 1–5ms | |
| **GPT API call (synchronous)** | **3,000–6,000ms** | **Primary bottleneck** |
| DB write (evidence_records) | 50–200ms | Blocking the response path unnecessarily |
| Network RTT out | 50–200ms | |
| **Total (cache miss)** | **~5,000–7,000ms** | Matches user reports |
| **Total (cache hit)** | **~200–500ms** | Target after fix |

---

## Fix 1 — SSE Streaming Endpoint (do this first)

**Why:** User perceived wait drops from 5–7s to <0.8s (time to first token). The router logic does not change. Only the response delivery changes.

### Backend: new streaming route (FastAPI)

Create or replace the query endpoint. Tier A/B hits return JSON immediately (they are already fast). Only Tier C goes through the stream.

```python
# app/api/query_stream.py
import asyncio
import json
from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import StreamingResponse, JSONResponse
import openai

router = APIRouter()

@router.post("/api/query/stream")
async def query_stream(request: QueryRequest, background_tasks: BackgroundTasks):

    # Tier A/B: fast path — return immediately, no streaming needed
    tier_result = await check_tiers(request.text)
    if tier_result.hit:
        background_tasks.add_task(write_evidence_async, request.session_id, tier_result)
        return JSONResponse({
            "content": tier_result.content,
            "tier": tier_result.tier,
            "source": "knowledge_base"
        })

    # Tier C: stream the LLM response
    knowledge_cards = await fetch_knowledge_cards(request.text)

    # Hard constraint from V11: no cards → escalate to L6, do not call LLM
    if not knowledge_cards:
        background_tasks.add_task(write_escalation_async, request.session_id, "NO_GROUNDING")
        return JSONResponse({"content": None, "tier": "L6", "reason": "NO_GROUNDING"}, status_code=200)

    async def event_generator():
        # Signal immediately that the system received the request
        yield f"data: {json.dumps({'type': 'thinking'})}\n\n"

        full_content = ""
        try:
            stream = await openai.chat.completions.create(
                model="gpt-4o-mini",   # locked — do not change to gpt-4o
                messages=build_messages(request, knowledge_cards),
                stream=True,
                max_tokens=800,
                temperature=0.3
            )
            async for chunk in stream:
                delta = chunk.choices[0].delta.content
                if delta:
                    full_content += delta
                    yield f"data: {json.dumps({'type': 'token', 'text': delta})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': 'Service temporarily unavailable'})}\n\n"
            await write_error_async(request.session_id, str(e))
            return

        # Write evidence in background — do not await here
        asyncio.create_task(write_evidence_async(request.session_id, full_content))
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",    # required for nginx not to buffer SSE
            "Connection": "keep-alive"
        }
    )
```

### Frontend: useStreamQuery hook (Next.js / React)

```typescript
// hooks/useStreamQuery.ts
import { useState, useCallback } from "react";

type StreamState = {
  content: string;
  isThinking: boolean;
  isDone: boolean;
  error: string | null;
  tier: string | null;
};

export function useStreamQuery() {
  const [state, setState] = useState<StreamState>({
    content: "",
    isThinking: false,
    isDone: false,
    error: null,
    tier: null,
  });

  const query = useCallback(async (text: string) => {
    setState({ content: "", isThinking: false, isDone: false, error: null, tier: null });

    let response: Response;
    try {
      response = await fetch("/api/query/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
    } catch {
      setState((s) => ({ ...s, error: "Network error", isDone: true }));
      return;
    }

    // Tier A/B fast path: plain JSON response
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await response.json();
      setState({ content: data.content, isThinking: false, isDone: true, error: null, tier: data.tier });
      return;
    }

    // Tier C: SSE stream
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const raw = decoder.decode(value, { stream: true });
      const lines = raw.split("\n\n").filter((l) => l.startsWith("data: "));

      for (const line of lines) {
        let event: { type: string; text?: string; message?: string };
        try {
          event = JSON.parse(line.slice(6));
        } catch {
          continue;
        }

        if (event.type === "thinking") {
          setState((s) => ({ ...s, isThinking: true }));
        } else if (event.type === "token" && event.text) {
          setState((s) => ({ ...s, isThinking: false, content: s.content + event.text }));
        } else if (event.type === "done") {
          setState((s) => ({ ...s, isDone: true }));
        } else if (event.type === "error") {
          setState((s) => ({ ...s, error: event.message ?? "Error", isDone: true }));
        }
      }
    }
  }, []);

  return { ...state, query };
}
```

### Frontend: AIResponseBox component

```tsx
// components/AIResponseBox.tsx
import { useStreamQuery } from "@/hooks/useStreamQuery";

export function AIResponseBox() {
  const { content, isThinking, isDone, error, query } = useStreamQuery();
  const [input, setInput] = useState("");

  return (
    <div className="ai-response-wrapper">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask about your rental situation..."
        rows={3}
      />
      <button onClick={() => query(input)} disabled={isThinking && !isDone}>
        Submit
      </button>

      <div className="ai-response-container" style={{ minHeight: 120 }}>
        {isThinking && !content && (
          <p className="thinking-indicator" aria-live="polite">
            Analyzing...
          </p>
        )}

        {content && (
          <>
            <p className="response-text">{content}</p>
            {!isDone && <span className="cursor" aria-hidden>|</span>}
          </>
        )}

        {isDone && content && (
          <p className="disclaimer">
            For reference only. Verify details against the original listing and official sources.
          </p>
        )}

        {isDone && content && (
          <div className="response-actions">
            <button onClick={() => navigator.clipboard.writeText(content)}>Copy</button>
            <button onClick={() => {/* open human help */}}>Contact support</button>
          </div>
        )}

        {error && (
          <div className="error-state">
            <p>Something went wrong. Please try again.</p>
            <button onClick={() => query(input)}>Retry</button>
            <button onClick={() => {/* open human help */}}>Contact support</button>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## Fix 2 — SQL Indexes (required before deploy)

Run these migrations. Do not skip. Without them Tier A/B can be 200–500ms on full table scans.

```sql
-- migrations/add_performance_indexes.sql

-- Tier B: full-text search on knowledge cards
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_knowledge_cards_fts
ON knowledge_cards
USING GIN(to_tsvector('japanese', coalesce(content, '') || ' ' || coalesce(title, '')));

-- Tier A: keyword array exact match
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_knowledge_cards_keywords
ON knowledge_cards USING GIN(keywords);

-- Tier C: pgvector approximate nearest neighbor
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_knowledge_cards_embedding
ON knowledge_cards USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- evidence_records: writes go fast, reads by session also fast
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_evidence_records_session
ON evidence_records (session_id, created_at DESC);
```

After running, verify with:

```sql
EXPLAIN ANALYZE
SELECT id, title, content
FROM knowledge_cards
WHERE to_tsvector('japanese', content || ' ' || title) @@ plainto_tsquery('japanese', '敷金');
-- Expect: Bitmap Index Scan on idx_knowledge_cards_fts, not Seq Scan
```

---

## Fix 3 — Async evidence_records write

Replace every synchronous `await db.evidence_records.insert(...)` that runs before returning the response.

Pattern to follow:

```python
# Before (blocks response)
async def process_query(request):
    result = await router.route(request)
    await write_evidence(request.session_id, result)   # ← blocks user
    return result

# After (non-blocking)
async def process_query(request, background_tasks: BackgroundTasks):
    result = await router.route(request)
    background_tasks.add_task(write_evidence_async, request.session_id, result)
    return result   # ← returns immediately

async def write_evidence_async(session_id: str, result):
    try:
        await db.evidence_records.insert(
            session_id=session_id,
            tier=result.tier,
            content=result.content,
            created_at=datetime.utcnow()
        )
    except Exception as e:
        # Log to alert queue — do NOT raise, do NOT affect the user response
        logger.error(f"evidence_write_failed session={session_id} error={e}")
```

---

## Fix 4 — Semantic cache (Redis upgrade)

This builds on the existing Redis cache in V11. Install the dependency first:

```bash
pip install sentence-transformers numpy
```

```python
# lib/semantic_cache.py
import hashlib
import json
from typing import Optional
import numpy as np
from sentence_transformers import SentenceTransformer
import redis.asyncio as aioredis

MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"
SIMILARITY_THRESHOLD = 0.92
KEY_LIST = "cache:query_keys"
MAX_CACHED = 1000
TTL = 86400  # 24 hours


class SemanticCache:
    def __init__(self, redis_client: aioredis.Redis):
        self.redis = redis_client
        self.encoder = SentenceTransformer(MODEL_NAME)

    def _embed(self, text: str) -> np.ndarray:
        return self.encoder.encode(text, normalize_embeddings=True).astype(np.float32)

    async def get(self, query: str) -> Optional[str]:
        query_vec = self._embed(query)
        keys = await self.redis.lrange(KEY_LIST, 0, MAX_CACHED - 1)

        for key in keys:
            raw = await self.redis.get(f"cache:emb:{key}")
            if not raw:
                continue
            cached_vec = np.frombuffer(raw, dtype=np.float32)
            similarity = float(np.dot(query_vec, cached_vec))  # already normalized
            if similarity >= SIMILARITY_THRESHOLD:
                result = await self.redis.get(f"cache:result:{key}")
                if result:
                    return result.decode()
        return None

    async def set(self, query: str, result: str) -> None:
        key = hashlib.sha256(query.encode()).hexdigest()[:16]
        vec = self._embed(query)
        pipe = self.redis.pipeline()
        pipe.set(f"cache:emb:{key}", vec.tobytes(), ex=TTL)
        pipe.set(f"cache:result:{key}", result, ex=TTL)
        pipe.lpush(KEY_LIST, key)
        pipe.ltrim(KEY_LIST, 0, MAX_CACHED - 1)
        await pipe.execute()
```

Wire it into the router before the Tier C LLM call:

```python
# In router.py — add before the LLM call
cached = await semantic_cache.get(request.text)
if cached:
    return RoutingResult(content=cached, tier="CACHE")

# ... proceed with LLM call ...
result = await call_llm(request, knowledge_cards)
await semantic_cache.set(request.text, result.content)
return result
```

---

## Fix 5 — Lock model version

Search the entire codebase for any `model=` references and enforce this table:

| Route | Allowed model | Forbidden |
|-------|--------------|-----------|
| Tier C query | `gpt-4o-mini` | `gpt-4o`, `gpt-4-turbo`, `gpt-4` |
| Language bridge | `gpt-4o-mini` | `gpt-4o` |
| Pre-escalation summary | `gpt-4o-mini` | `gpt-4o` |

```python
# config.py — single source of truth
LLM_MODEL = "gpt-4o-mini"   # do not override per-call

# In any call site:
model=settings.LLM_MODEL    # not a hardcoded string
```

---

## APM Setup (required — do not skip)

Without APM you cannot verify any of the above actually worked.

Minimum setup with Sentry:

```python
# main.py
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

sentry_sdk.init(
    dsn=settings.SENTRY_DSN,
    integrations=[FastApiIntegration()],
    traces_sample_rate=1.0,   # 100% sampling until baseline is established
    profiles_sample_rate=0.1,
)
```

What to verify after deploy:

```
P95 TTFT (time to first token):  target < 800ms
P95 full Tier C response:        target < 4,000ms
P95 Tier A response:             target < 50ms
P95 Tier B response:             target < 200ms
Cache hit response:              target < 100ms
evidence_records write failures: target < 0.5% (alert if exceeded)
```

---

## Mobile CSS (do not skip)

Streaming text growth causes layout jank on mobile. Add these styles:

```css
/* Stable container — prevents height jumping as tokens arrive */
.ai-response-container {
  min-height: 120px;
  overflow-wrap: break-word;
  word-break: break-word;
  transition: min-height 0.15s ease;
}

/* Blinking cursor during streaming */
.cursor {
  display: inline-block;
  width: 2px;
  background: currentColor;
  animation: blink 1s step-end infinite;
  margin-left: 1px;
  vertical-align: text-bottom;
  height: 1.1em;
}
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* Thinking pulse */
.thinking-indicator {
  animation: pulse 1.5s ease-in-out infinite;
  opacity: 0.6;
}
@keyframes pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.9; }
}
```

Blur the input when streaming starts to prevent the mobile keyboard from overlapping the output area:

```typescript
// In AIResponseBox, when streaming starts:
if (event.type === "thinking") {
  (document.activeElement as HTMLElement)?.blur();
  setState((s) => ({ ...s, isThinking: true }));
}
```

---

## Acceptance Checklist

All of these must be true before the sprint is closed.

### Code changes
- [ ] `/api/query/stream` SSE endpoint deployed
- [ ] `useStreamQuery` hook wired into the main query UI
- [ ] All 4 SQL indexes created and verified with `EXPLAIN ANALYZE` (no Seq Scan)
- [ ] `evidence_records` writes are async / non-blocking
- [ ] `LLM_MODEL = "gpt-4o-mini"` enforced across all call sites
- [ ] Semantic cache deployed and wired into Tier C path

### APM verification (measure after deploy, not before)
- [ ] TTFT P95 < 800ms confirmed in Sentry/Datadog
- [ ] Tier A P95 < 50ms confirmed
- [ ] No increase in evidence_records write failure rate
- [ ] Before/after TTFT comparison screenshot saved

### UI verification
- [ ] "Analyzing..." appears within 500ms of submit on mobile
- [ ] Typewriter effect visible during Tier C streaming
- [ ] No layout jank on iPhone Safari at 375px
- [ ] Retry + support buttons visible on error state
- [ ] Action buttons (Copy, Contact support) appear only after `isDone === true`

---

## What NOT to do in this sprint

Do not add any of the following — they are out of scope and add complexity without fixing the latency problem:

- WebSocket (SSE is sufficient)
- vLLM or any self-hosted inference server
- Edge/CDN caching of API responses
- Multiple concurrent LLM calls
- Model fine-tuning
- Any change to the V11 routing logic (Tier A → B → Redis → C → L6)

---

*Version: JTG-V12-Claude-Code-Instructions*  
*Date: 2026-04-13*  
*Prerequisite: V11 routing (Tier A/B/C + L6 escalation) must already be in place*  
*Done signal: TTFT P95 < 800ms confirmed in APM + all checklist items above checked*
