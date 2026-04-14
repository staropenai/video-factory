# JTG Homepage Frontend V4 — Streaming UI Spec
# For Claude Code execution

**Prerequisite:** V3 frontend spec is already implemented. This file adds one thing only: the AI response area streaming states. All other V3 rules remain unchanged.

**Do not touch:** information architecture, copy rules, contact path split, mobile constraints, FAQ disclaimer, external link labels — those are in V3 and already done.

---

## What to build

The AI response area needs three explicit visual states. Currently there are none — the user submits a query and sees a blank area for 5–7 seconds. That is the only problem this file solves.

---

## State 1 — Thinking

**When:** User submits. No tokens have arrived yet. Duration: 0ms to ~800ms.

**What to show:**
- Short animated text: `Analyzing…` (Japanese: `解析中…`, Chinese: `正在分析…`)  
- Soft pulse animation — not a spinner
- The area must not be blank

**What not to show:**
- Empty white space
- A percentage progress bar
- Any promise about how long it will take

```tsx
// ThinkingIndicator.tsx
export function ThinkingIndicator({ language }: { language: "en" | "ja" | "zh" }) {
  const labels = { en: "Analyzing…", ja: "解析中…", zh: "正在分析…" };
  return (
    <p
      className="thinking-indicator"
      aria-live="polite"
      aria-label={labels[language]}
    >
      {labels[language]}
    </p>
  );
}
```

```css
.thinking-indicator {
  color: var(--text-secondary);
  animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 0.4; }
  50%       { opacity: 0.9; }
}
```

---

## State 2 — Streaming

**When:** First token has arrived. Tokens continue to arrive.

**What to show:**
- Text appears character by character (typewriter effect)
- A blinking cursor at the end of the current text
- Nothing else — no action buttons, no disclaimer yet

**What not to show:**
- The "Analyzing…" animation (replace it the moment the first token arrives)
- Copy / Contact buttons (show these only after done)
- Any loading UI

```tsx
// StreamingText.tsx
export function StreamingText({ content }: { content: string }) {
  return (
    <div className="streaming-text" aria-live="polite" aria-atomic="false">
      <span>{content}</span>
      <span className="cursor" aria-hidden="true" />
    </div>
  );
}
```

```css
.cursor {
  display: inline-block;
  width: 2px;
  height: 1.1em;
  background: currentColor;
  vertical-align: text-bottom;
  margin-left: 1px;
  animation: blink 1s step-end infinite;
}
@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}
```

---

## State 3 — Complete

**When:** The `done` event arrives from the SSE stream (or Tier A/B JSON response received).

**What to show:**
- Full response text, static (cursor gone)
- Disclaimer line below the response (Tier C only): `For reference only. Verify against the original listing and official sources.`
- Two action buttons: **Copy** and **Contact support**

**Tier A/B (knowledge base hit):** Show the response immediately without typewriter animation. Show a small label `From knowledge base` instead of the disclaimer.

```tsx
// AIResponseComplete.tsx
export function AIResponseComplete({
  content,
  tier,
  onContactSupport,
}: {
  content: string;
  tier: string;
  onContactSupport: () => void;
}) {
  const isTierC = tier === "C" || tier === "CACHE";

  return (
    <div className="response-complete">
      <p className="response-text">{content}</p>

      {isTierC ? (
        <p className="disclaimer">
          For reference only. Verify details against the original listing and official sources.
        </p>
      ) : (
        <p className="source-label">From knowledge base</p>
      )}

      <div className="response-actions">
        <button onClick={() => navigator.clipboard.writeText(content)}>Copy</button>
        <button onClick={onContactSupport}>Contact support</button>
      </div>
    </div>
  );
}
```

---

## Error State

**When:** Network error or API error.

**What to show:**
- Short message: `Something went wrong. Please try again.`
- **Retry** button (re-runs the same query)
- **Contact support** button (must stay visible — do not hide it on error)

**What not to show:**
- Technical error details
- Auto-refresh

```tsx
// AIResponseError.tsx
export function AIResponseError({
  onRetry,
  onContactSupport,
}: {
  onRetry: () => void;
  onContactSupport: () => void;
}) {
  return (
    <div className="response-error" role="alert">
      <p>Something went wrong. Please try again.</p>
      <button onClick={onRetry}>Retry</button>
      <button onClick={onContactSupport}>Contact support</button>
    </div>
  );
}
```

---

## Container — stable layout, no jank

The response container must have a `min-height` so the page does not jump when content arrives. On mobile this is critical — height jumps cause scroll position to shift.

```css
.ai-response-container {
  min-height: 120px;
  overflow-wrap: break-word;
  word-break: break-word;
  transition: min-height 0.15s ease;
}
```

Blur the input on streaming start to prevent the mobile keyboard from overlapping the output:

```typescript
// In useStreamQuery, when type === "thinking":
(document.activeElement as HTMLElement)?.blur();
```

---

## Composing it all together

```tsx
// AIResponseArea.tsx
import { useStreamQuery } from "@/hooks/useStreamQuery";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { StreamingText } from "./StreamingText";
import { AIResponseComplete } from "./AIResponseComplete";
import { AIResponseError } from "./AIResponseError";

export function AIResponseArea({
  language,
  onContactSupport,
}: {
  language: "en" | "ja" | "zh";
  onContactSupport: () => void;
}) {
  const { content, isThinking, isDone, error, tier, query } = useStreamQuery();
  const [input, setInput] = useState("");

  const handleSubmit = () => {
    if (input.trim()) query(input.trim());
  };

  return (
    <div className="ai-response-wrapper">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }}}
        placeholder={
          language === "ja" ? "質問を入力…" :
          language === "zh" ? "输入问题…" :
          "Ask a question…"
        }
        rows={3}
        disabled={isThinking && !isDone}
      />
      <button onClick={handleSubmit} disabled={isThinking && !isDone}>
        {language === "ja" ? "送信" : language === "zh" ? "提交" : "Submit"}
      </button>

      <div className="ai-response-container">
        {isThinking && !content && !error && (
          <ThinkingIndicator language={language} />
        )}

        {content && !isDone && (
          <StreamingText content={content} />
        )}

        {isDone && content && !error && (
          <AIResponseComplete
            content={content}
            tier={tier ?? "C"}
            onContactSupport={onContactSupport}
          />
        )}

        {error && (
          <AIResponseError
            onRetry={handleSubmit}
            onContactSupport={onContactSupport}
          />
        )}
      </div>
    </div>
  );
}
```

---

## Property analysis flow (screenshot / URL / text input)

When a user submits a listing for analysis, show progress stages instead of a single spinner. Each stage message describes what the system is currently doing — not what it will accomplish.

```typescript
// stages shown sequentially, each replaced by the next
const ANALYSIS_STAGES = {
  en: ["Reading image…", "Extracting key fields…", "Analyzing…"],
  ja: ["画像を読み取り中…", "情報を抽出中…", "分析中…"],
  zh: ["正在读取图片…", "提取关键信息…", "正在分析…"],
};
```

Display rules for stage text:
- Stage 1 appears immediately on submit
- Stage 2 appears once OCR/fetch completes (or after 1.5s timeout fallback)
- Stage 3 appears once fields are parsed (or after 3s timeout fallback)
- Stage 3 transitions directly into the streaming output state

After analysis completes, show a structured layout, not a wall of text:

```
[Key property info — if extractable]
  Address: …
  Size: …
  Monthly rent: …

[AI analysis]
  … (streamed)

[Points to verify]
  - …

⚠ For reference only. Verify against the original listing.
```

Prohibited in stage labels:
- `100% recognizing all fields…`
- `Smart analysis: 60% complete…`
- Any fake percentage progress

Allowed:
- `Trying to extract key fields…`
- `Analyzing…`

---

## Human help button visibility rule

The contact support button must remain visible at all times during streaming. It must not be hidden because AI output is in progress.

Implementation: fix the contact support button to the bottom of the viewport (or to the bottom of the response wrapper). The streaming output area scrolls independently above it.

```css
.human-help-fixed {
  position: sticky;
  bottom: env(safe-area-inset-bottom, 16px);
  z-index: 10;
  background: var(--surface);
  padding: 8px 16px;
}
```

---

## Acceptance checklist

- [ ] Blank waiting area is gone — `Analyzing…` appears within 500ms of submit
- [ ] First token starts replacing the thinking indicator immediately
- [ ] Typewriter cursor blinks during streaming, disappears on done
- [ ] Tier A/B responses: no typewriter animation, show `From knowledge base` label
- [ ] Tier C responses: disclaimer appears after `isDone === true`
- [ ] Copy and Contact buttons appear only after `isDone === true`
- [ ] Error state shows Retry + Contact buttons (both, always)
- [ ] No layout height jump on mobile when content arrives (min-height set)
- [ ] Mobile keyboard dismissed on stream start (blur on thinking)
- [ ] Human help button remains visible during streaming
- [ ] Property analysis shows three sequential stage labels (not a spinner)
- [ ] No fake progress percentages anywhere

---

*Version: JTG-Frontend-V4-Claude-Code*  
*Date: 2026-04-13*  
*Scope: streaming UI states only — all other V3 rules unchanged*
