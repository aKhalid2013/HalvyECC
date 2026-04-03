# ai-integration.md
**Project:** Next-Gen Social Expense Splitting Ecosystem
**Version:** 2.0
**Depends on:** schema.md, api-contracts.md, expense-logic.md, env-and-config.md

> **v2.0 changes:** Fixed critical security issue — `geminiClient.ts` now calls the Supabase Edge Function proxy (`ai-proxy`) instead of calling the Gemini API directly from the client. The Gemini API key is no longer exposed in the app bundle. All rate limiting and budget enforcement remain server-side in the proxy. Updated assumptions table. Updated Section 1 client code. Updated Section 9 file locations.

---

## Assumptions & Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| AI provider | Gemini API (gemini-1.5-flash) | Single multimodal endpoint for both image and audio |
| Gemini API call path | Client → Supabase Edge Function proxy → Gemini | API key never exposed in app bundle; rate + budget enforcement server-side |
| Image pre-processing | Resize + compress + contrast enhancement | Maximises OCR accuracy on poor-quality receipts |
| Multi-page receipts | Up to 3 images per expense | Covers long receipts without unbounded complexity |
| OCR failure behaviour | Retry once, then fall back to manual entry | Avoids blocking the user on transient failures |
| Voice input method | Send audio file directly to Gemini (via proxy) | No on-device transcription step; simpler pipeline |
| Voice failure behaviour | Show error, prompt to try again | Clean retry UX; no partial or ambiguous state |
| Multiple expenses per dictation | Supported | One utterance can produce multiple Expense Cards |
| AI output presentation | Preview screen first | User always reviews before anything is saved |
| Member name matching | Fuzzy match against group display names | Reduces manual assignment after voice dictation |
| Debug logging | Dev mode only | Never logs in production; receipt images never logged |
| AI rate limiting | Per-user hourly + daily caps | Prevents runaway costs; manual entry always available as fallback |
| AI cost model | Budget-capped with monitoring | System-wide monthly budget with alerts at 70% and 90% thresholds |

---

## 1. Gemini Client

All AI calls are made through a single wrapper in `src/features/ai/utils/geminiClient.ts`. The client calls the **Supabase Edge Function proxy** — never the Gemini API directly. The Gemini API key lives only on the server and is never bundled into the app.

```typescript
// src/features/ai/utils/geminiClient.ts
import { supabase } from '@/api/client'

export interface GeminiPart {
  text?:       string
  inlineData?: { mimeType: string; data: string }  // base64
}

interface ProxyRequest {
  parts:            GeminiPart[]
  temperature?:     number
  maxOutputTokens?: number
}

interface ProxyResponse {
  result?:  string
  error?:   string
  code?:    'RATE_LIMITED' | 'AI_BUDGET_EXHAUSTED' | 'PROXY_ERROR'
}

export async function callGemini(parts: GeminiPart[]): Promise<string> {
  const body: ProxyRequest = {
    parts,
    temperature:     0.1,   // Low temperature — deterministic structured output
    maxOutputTokens: 2048,
  }

  const { data, error } = await supabase.functions.invoke<ProxyResponse>('ai-proxy', {
    body,
  })

  if (error) {
    throw new Error(`AI proxy error: ${error.message}`)
  }

  if (data?.code === 'RATE_LIMITED') {
    throw Object.assign(new Error('Rate limit exceeded'), { code: 'RATE_LIMITED' })
  }

  if (data?.code === 'AI_BUDGET_EXHAUSTED') {
    throw Object.assign(new Error('AI budget exhausted'), { code: 'AI_BUDGET_EXHAUSTED' })
  }

  if (data?.code === 'PROXY_ERROR' || !data?.result) {
    throw new Error(`AI proxy returned an error: ${data?.error ?? 'unknown'}`)
  }

  return data.result
}
```

**Notes:**
- `supabase.functions.invoke` automatically attaches the authenticated user's JWT. The proxy validates this before forwarding to Gemini.
- `temperature: 0.1` keeps outputs deterministic and structured. Never use high temperature for financial parsing.
- Error codes `RATE_LIMITED` and `AI_BUDGET_EXHAUSTED` are handled by the calling hooks to show appropriate UI.
- All calls are wrapped in try/catch by the calling hook. The client itself throws on non-200 responses.

---

## 1.1 Edge Function Proxy

The proxy (`supabase/functions/ai-proxy/index.ts`) is the only place in the entire codebase that holds or uses the Gemini API key. It:

1. Validates the caller's Supabase JWT — unauthenticated requests are rejected immediately
2. Checks the caller's per-user rate limits (`rate_limits` table)
3. Checks the system-wide monthly AI budget (`ai_budget` table)
4. If all checks pass, forwards the request to Gemini using `GEMINI_API_KEY` from `Deno.env.get()`
5. Logs the call and increments usage counters
6. Returns the Gemini response (or an error code) to the client

```typescript
// supabase/functions/ai-proxy/index.ts  (outline — implementation by AI agent)

import { serve } from 'https://deno.land/std/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!
const GEMINI_MODEL   = 'gemini-1.5-flash'
const BASE_URL       = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

serve(async (req) => {
  // 1. Validate JWT — reject unauthenticated requests
  // 2. Check per-user rate limits
  // 3. Check system-wide budget
  // 4. Forward to Gemini
  // 5. Log call + increment counters
  // 6. Return { result } or { error, code }
})
```

> **Security rule:** `GEMINI_API_KEY` is set as a Supabase Edge Function environment variable (not an EAS secret, not in `app.config.ts`, not in `.env`). It is never accessible to the client app under any circumstances.

---

## 2. OCR Flow

### 2.1 Full Pipeline

```
User taps camera icon
        │
        ▼
Capture 1–3 receipt images (Expo ImagePicker / Camera)
        │
        ▼
Pre-process each image (see Section 2.2)
        │
        ▼
Convert to base64
        │
        ▼
Check client-side rate limit (see Section 8) — for immediate UX feedback
        │
        ├── Rate limited → Show "AI entry cooling down" toast + offer manual entry
        │
        └── Allowed → Send parts to proxy via callGemini() (see Section 1)
                │
                ├── RATE_LIMITED from proxy → Show rate limit toast
                ├── AI_BUDGET_EXHAUSTED     → Show budget exhausted banner
                │
                └── Success → Parse JSON response (see Section 2.4)
                                │
                                ▼
                            Show AI Preview Screen
                                │
                                ▼
                            User confirms / edits
                                │
                                ▼
                            Populate expense form
                │
                └── No line items extracted → Retry once
                                │
                                ├── Retry succeeds → Preview Screen
                                └── Retry fails    → Manual entry form
                                                     pre-filled with total only
```

### 2.2 Image Pre-Processing

Implemented in `src/features/ai/utils/imageProcessor.ts` using `expo-image-manipulator`.

```typescript
import * as ImageManipulator from 'expo-image-manipulator'

interface ProcessedImage {
  base64:    string
  mimeType:  'image/jpeg'
  width:     number
  height:    number
}

export async function preprocessReceiptImage(uri: string): Promise<ProcessedImage> {
  // Step 1 — Resize: max 1600px on longest edge, maintain aspect ratio
  // Step 2 — Compress: JPEG quality 0.85 (balance between detail and file size)
  // Step 3 — Contrast enhancement: brightness +10%, contrast +20%

  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1600 } }],
    {
      compress:  0.85,
      format:    ImageManipulator.SaveFormat.JPEG,
      base64:    true,
    }
  )

  return {
    base64:   result.base64!,
    mimeType: 'image/jpeg',
    width:    result.width,
    height:   result.height,
  }
}
```

**Multi-page handling:** If the user captures multiple images, each is pre-processed independently and all are sent in a single proxy request as separate `inlineData` parts. Maximum 3 images per request.

### 2.3 OCR Prompt Template

```typescript
// src/features/ai/utils/ocrPrompt.ts

export function buildOcrPrompt(imageCount: number, currency: string): string {
  return `
You are a receipt parsing assistant. Analyse the provided receipt image${imageCount > 1 ? 's' : ''} and extract all line items.

RULES:
- Extract every individual item with its description and amount.
- Identify tax lines (sales tax, VAT, GST, service charge) — mark as isTax: true.
- Identify tip/gratuity lines — mark as isTip: true.
- Do NOT invent items. If you cannot read an item clearly, include it with a low confidence score.
- All amounts must be in ${currency}. Strip currency symbols.
- Return amounts as numbers with 2 decimal places only.
- If the receipt has a clearly printed TOTAL, include it as receiptTotal.
- Assign a confidence score (0.0–1.0) to each line item based on legibility.
- If you cannot extract ANY line items, return an empty lineItems array — do not guess.

IMPORTANT: Return ONLY valid JSON. No explanation, no markdown, no preamble.

Return this exact JSON structure:
{
  "receiptTotal": number | null,
  "lineItems": [
    {
      "description":   string,
      "amount":        number,
      "isTax":         boolean,
      "isTip":         boolean,
      "confidence":    number
    }
  ],
  "warnings": string[]
}
`.trim()
}
```

### 2.4 OCR Response Parsing

```typescript
// src/features/ai/utils/ocrResponseParser.ts

export interface OcrLineItem {
  description: string
  amount:      number
  isTax:       boolean
  isTip:       boolean
  confidence:  number
}

export interface OcrResult {
  receiptTotal:     number | null
  lineItems:        OcrLineItem[]
  warnings:         string[]
  extractionFailed: boolean
}

export function parseOcrResponse(raw: string): OcrResult {
  try {
    const parsed = JSON.parse(raw)

    const lineItems: OcrLineItem[] = (parsed.lineItems ?? []).map((item: any) => ({
      description: String(item.description ?? 'Unrecognised item'),
      amount:      Number(item.amount ?? 0),
      isTax:       Boolean(item.isTax),
      isTip:       Boolean(item.isTip),
      confidence:  Math.min(1, Math.max(0, Number(item.confidence ?? 0))),
    }))

    return {
      receiptTotal:     parsed.receiptTotal ?? null,
      lineItems,
      warnings:         parsed.warnings ?? [],
      extractionFailed: lineItems.length === 0,
    }
  } catch {
    return {
      receiptTotal:     null,
      lineItems:        [],
      warnings:         ['Failed to parse AI response'],
      extractionFailed: true,
    }
  }
}
```

### 2.5 OCR Hook

```typescript
// src/features/ai/hooks/useOCR.ts

export type OcrStatus =
  | 'idle'
  | 'capturing'
  | 'processing'
  | 'retrying'
  | 'preview'
  | 'failed'
  | 'rate_limited'

export function useOCR(groupCurrency: string) {
  const [status,    setStatus]    = useState<OcrStatus>('idle')
  const [result,    setResult]    = useState<OcrResult | null>(null)
  const [imageUris, setImageUris] = useState<string[]>([])

  async function runOCR(uris: string[]) {
    // Check client-side rate limit first — immediate UX feedback before any processing
    const rateCheck = checkRateLimit('ai_ocr', 20, 60 * 60 * 1000)
    if (!rateCheck.allowed) {
      setStatus('rate_limited')
      return
    }

    setStatus('processing')
    setImageUris(uris)

    const attempt = async (): Promise<OcrResult> => {
      const processed = await Promise.all(uris.map(preprocessReceiptImage))
      const parts: GeminiPart[] = [
        { text: buildOcrPrompt(uris.length, groupCurrency) },
        ...processed.map(img => ({
          inlineData: { mimeType: img.mimeType, data: img.base64 }
        }))
      ]
      const raw = await callGemini(parts)
      return parseOcrResponse(raw)
    }

    try {
      let ocrResult = await attempt()

      if (ocrResult.extractionFailed) {
        setStatus('retrying')
        ocrResult = await attempt()  // Retry once
      }

      if (ocrResult.extractionFailed) {
        setStatus('failed')
        return
      }

      setResult(ocrResult)
      setStatus('preview')
    } catch (err: any) {
      if (err.code === 'RATE_LIMITED') {
        setStatus('rate_limited')
      } else {
        setStatus('failed')
      }
    }
  }

  return { status, result, imageUris, runOCR }
}
```

---

## 3. Voice Dictation Flow

### 3.1 Full Pipeline

```
User holds microphone button
        │
        ▼
Record audio (Expo Audio — m4a format)
        │
        ▼
User releases button — recording stops
        │
        ▼
Check client-side rate limit (see Section 8)
        │
        ├── Rate limited → Show "AI entry cooling down" toast + offer manual entry
        │
        └── Allowed → Convert audio to base64
                        │
                        ▼
                Send to proxy via callGemini() with voice prompt + group context
                        │
                        ├── RATE_LIMITED from proxy → Show rate limit toast
                        ├── AI_BUDGET_EXHAUSTED     → Show budget exhausted banner
                        │
                        ├── Success → Parse JSON response (see Section 3.3)
                        │               │
                        │               ▼
                        │           Fuzzy match member names (see Section 3.4)
                        │               │
                        │               ▼
                        │           Show AI Preview Screen (one card per expense)
                        │               │
                        │               ▼
                        │           User confirms / edits each
                        │
                        └── Parse failure → Show error toast
                                            "Couldn't understand that — please try again"
                                            Return to idle state (no partial data shown)
```

### 3.2 Voice Prompt Template

```typescript
// src/features/ai/utils/voicePrompt.ts

export function buildVoicePrompt(groupMembers: GroupMember[], currency: string): string {
  const memberList = groupMembers
    .map(m => m.displayName)
    .join(', ')

  return `
You are an expense parsing assistant for a group expense splitting app.
The user has dictated one or more shared expenses. Extract all expenses from the audio.

GROUP MEMBERS: ${memberList}
CURRENCY: ${currency}

RULES:
- Extract every expense mentioned. Multiple expenses in one recording are allowed.
- For each expense, identify: title, total amount, payer, and how to split.
- Match member names to the group member list above (fuzzy match — "Mike" may mean "Michael").
- If a member name is mentioned but does not match anyone, set userId to null and keep the raw name in unmatchedName.
- Splitting instructions: "split equally", "split between X and Y", "put X on Y", "divide among everyone".
- If no splitting instruction is given, default to equal split among all members.
- If no payer is mentioned, set payerUserId to null.
- Do NOT invent amounts or members. If unclear, set confidence to low.
- Return ONLY valid JSON. No explanation, no markdown.

Return this exact JSON structure:
{
  "expenses": [
    {
      "title":       string,
      "totalAmount": number,
      "payerUserId": string | null,
      "payerName":   string | null,
      "confidence":  number,
      "splits": [
        {
          "userId":        string | null,
          "unmatchedName": string | null,
          "displayName":   string,
          "amountOwed":    number
        }
      ]
    }
  ],
  "parseFailed": boolean,
  "warnings":    string[]
}
`.trim()
}
```

### 3.3 Voice Response Parsing

```typescript
// src/features/ai/utils/voiceResponseParser.ts

export interface VoiceSplit {
  userId:        string | null
  unmatchedName: string | null
  displayName:   string
  amountOwed:    number
}

export interface VoiceExpense {
  title:       string
  totalAmount: number
  payerUserId: string | null
  payerName:   string | null
  confidence:  number
  splits:      VoiceSplit[]
}

export interface VoiceResult {
  expenses:    VoiceExpense[]
  parseFailed: boolean
  warnings:    string[]
}

export function parseVoiceResponse(raw: string): VoiceResult {
  try {
    const parsed = JSON.parse(raw)

    if (parsed.parseFailed || !parsed.expenses?.length) {
      return { expenses: [], parseFailed: true, warnings: parsed.warnings ?? [] }
    }

    const expenses: VoiceExpense[] = parsed.expenses.map((e: any) => ({
      title:       String(e.title ?? 'Expense'),
      totalAmount: Number(e.totalAmount ?? 0),
      payerUserId: e.payerUserId ?? null,
      payerName:   e.payerName ?? null,
      confidence:  Math.min(1, Math.max(0, Number(e.confidence ?? 0))),
      splits: (e.splits ?? []).map((s: any) => ({
        userId:        s.userId ?? null,
        unmatchedName: s.unmatchedName ?? null,
        displayName:   String(s.displayName ?? ''),
        amountOwed:    Number(s.amountOwed ?? 0),
      }))
    }))

    return { expenses, parseFailed: false, warnings: parsed.warnings ?? [] }
  } catch {
    return { expenses: [], parseFailed: true, warnings: ['Failed to parse AI response'] }
  }
}
```

### 3.4 Fuzzy Member Name Matching

```typescript
// src/features/ai/utils/memberMatcher.ts

export function fuzzyMatchMember(
  name:    string,
  members: GroupMember[]
): GroupMember | null {
  const normalise = (s: string) => s.toLowerCase().trim()
  const target    = normalise(name)

  // 1. Exact match
  const exact = members.find(m => normalise(m.displayName) === target)
  if (exact) return exact

  // 2. Starts-with match (e.g. "Mike" matches "Michael")
  const startsWith = members.find(m => normalise(m.displayName).startsWith(target))
  if (startsWith) return startsWith

  // 3. Contains match (e.g. "Smith" matches "John Smith")
  const contains = members.find(m => normalise(m.displayName).includes(target))
  if (contains) return contains

  // 4. No match — leave unresolved for user to assign manually
  return null
}
```

Unresolved names are shown in the preview screen with an amber highlight and a member picker dropdown.

### 3.5 Voice Hook

```typescript
// src/features/ai/hooks/useVoiceDictation.ts

export type VoiceStatus =
  | 'idle'
  | 'recording'
  | 'processing'
  | 'preview'
  | 'failed'
  | 'rate_limited'

export function useVoiceDictation(group: Group, members: GroupMember[]) {
  const [status,    setStatus]    = useState<VoiceStatus>('idle')
  const [result,    setResult]    = useState<VoiceResult | null>(null)
  const [recording, setRecording] = useState<Audio.Recording | null>(null)

  async function startRecording() {
    await Audio.requestPermissionsAsync()
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true })
    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    )
    setRecording(recording)
    setStatus('recording')
  }

  async function stopAndProcess() {
    if (!recording) return

    // Check client-side rate limit first — immediate UX feedback
    const rateCheck = checkRateLimit('ai_voice', 20, 60 * 60 * 1000)
    if (!rateCheck.allowed) {
      await recording.stopAndUnloadAsync()
      setStatus('rate_limited')
      return
    }

    setStatus('processing')
    await recording.stopAndUnloadAsync()

    const uri    = recording.getURI()!
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64
    })

    try {
      const parts: GeminiPart[] = [
        { text: buildVoicePrompt(members, group.currency) },
        { inlineData: { mimeType: 'audio/m4a', data: base64 } }
      ]

      const raw    = await callGemini(parts)
      const parsed = parseVoiceResponse(raw)

      if (parsed.parseFailed) {
        setStatus('failed')
        return
      }

      // Apply fuzzy matching to any unresolved member names
      const resolved = parsed.expenses.map(expense => ({
        ...expense,
        splits: expense.splits.map(split => {
          if (split.userId) return split
          const match = split.unmatchedName
            ? fuzzyMatchMember(split.unmatchedName, members)
            : null
          return { ...split, userId: match?.userId ?? null }
        })
      }))

      setResult({ ...parsed, expenses: resolved })
      setStatus('preview')
    } catch (err: any) {
      if (err.code === 'RATE_LIMITED') {
        setStatus('rate_limited')
      } else {
        setStatus('failed')
      }
    }
  }

  return { status, result, startRecording, stopAndProcess }
}
```

---

## 4. AI Preview Screen

Both OCR and voice flows end at the same preview screen before anything is written to the database.

### 4.1 OCR Preview Contents
- List of extracted line items with description, amount, and confidence indicator.
- Low/medium confidence items highlighted with amber/red left border.
- Editable fields — user can tap any line item to edit description or amount.
- Extracted total shown alongside computed sum of line items — flagged if they differ by > $0.01.
- "Confirm" button → populates the expense form for member assignment.
- "Start over" button → returns to camera capture.

### 4.2 Voice Preview Contents
- One Expense Card preview per extracted expense.
- Each card shows: title, total, payer (if resolved), and split breakdown.
- Unresolved member names shown with amber highlight and inline member picker.
- User can edit any field inline before confirming.
- "Confirm all" → submits all expenses atomically via `createExpense`.
- "Remove" button on each card to discard individual expenses before confirming.

---

## 5. Error States & Fallbacks

| Scenario | Behaviour |
|---|---|
| OCR extracts no line items (attempt 1) | Auto-retry once silently |
| OCR extracts no line items (attempt 2) | Fall back to manual entry form, total pre-filled if extracted |
| OCR JSON parse error | Treat as extraction failure, follow retry → fallback flow |
| Voice parse failed | Show error toast: "Couldn't understand that — please try again." Return to idle. |
| Proxy returns non-200 | Show error toast: "Something went wrong — please try again." Log error in dev mode. |
| Proxy timeout (> 15 seconds) | Cancel request, show timeout toast, return to idle |
| Audio recording permission denied | Show permission prompt explaining why microphone access is needed |
| Camera permission denied | Show permission prompt explaining why camera access is needed |
| Hourly AI rate limit hit (client or proxy) | Show toast: "AI entry is cooling down. Try again in X minutes." Offer manual entry. |
| Daily AI quota exhausted | Show persistent banner: "Daily AI limit reached." Highlight manual entry button. AI entry buttons greyed out. |
| System-wide AI budget exhausted | Show banner: "AI features temporarily unavailable." All AI entry options hidden. Manual entry only. |

---

## 6. Debug Logging

Active in **dev mode only** (`__DEV__ === true`). Never enabled in production. Receipt images and audio files are never logged even in dev mode.

```typescript
// src/utils/logger.ts

export const logger = {
  ai: (label: string, data: unknown) => {
    if (__DEV__) {
      console.group(`[AI] ${label}`)
      const sanitised = sanitiseForLog(data)
      console.log(JSON.stringify(sanitised, null, 2))
      console.groupEnd()
    }
  }
}

function sanitiseForLog(data: unknown): unknown {
  if (typeof data !== 'object' || data === null) return data
  return Object.fromEntries(
    Object.entries(data as Record<string, unknown>).map(([k, v]) => [
      k,
      typeof v === 'string' && v.length > 200 ? '[base64 omitted]' : sanitiseForLog(v)
    ])
  )
}
```

Logged events:
- Proxy request parts (sanitised — no image/audio data)
- Proxy raw response
- Parsed OCR / voice result
- Fuzzy match results
- Rate limit checks and outcomes
- Any errors or retries

---

## 7. Gemini Configuration Reference

| Parameter | OCR | Voice | Rationale |
|---|---|---|---|
| Model | `gemini-1.5-flash` | `gemini-1.5-flash` | Fastest multimodal model; sufficient for structured extraction |
| Temperature | 0.1 | 0.1 | Deterministic output; financial data must not be creative |
| Max output tokens | 2048 | 2048 | Sufficient for any realistic receipt or dictation |
| Response MIME type | `application/json` | `application/json` | Forces valid JSON; no markdown fences to strip |
| Timeout | 15 seconds | 15 seconds | Cancel and surface error if exceeded |
| Retry on extraction failure | Once (OCR only) | None | Voice failure prompts user to re-record |

---

## 8. AI Rate Limiting & Cost Budget

### 8.1 Per-User Rate Limits

Rate limits are enforced at two layers: client-side (for immediate UX feedback) and server-side in the proxy (authoritative enforcement).

| Limit | Cap | Window | Scope |
|---|---|---|---|
| OCR calls | 20 | 1 hour | Per user |
| Voice calls | 20 | 1 hour | Per user |
| Total AI calls (OCR + voice) | 50 | 24 hours | Per user |

**Notes:**
- A failed OCR attempt that triggers an automatic retry counts as 2 calls.
- Client-side rate limit check happens before image/audio processing to avoid wasting compute.
- Server-side enforcement in the proxy is the authoritative gate — client-side is UX only.
- When a rate limit is hit, the UI immediately offers manual entry as a fallback.

### 8.2 System-Wide AI Cost Budget

A monthly budget cap prevents AI costs from scaling unpredictably. Enforced exclusively in the Edge Function proxy.

#### Cost Model

| Operation | Estimated cost per call | Basis |
|---|---|---|
| OCR (1 image) | ~$0.002 | ~1000 input tokens (image) + ~500 output tokens |
| OCR (3 images) | ~$0.005 | ~3000 input tokens + ~800 output tokens |
| OCR retry | Same as original | Retry is a full duplicate call |
| Voice dictation | ~$0.003 | ~30s audio ≈ ~1500 input tokens + ~500 output tokens |

#### Budget Tiers

| Tier | Monthly budget | Expected coverage | Target phase |
|---|---|---|---|
| Development | $10 | ~3,000 AI calls | Dev + staging |
| Launch | $100 | ~30,000 AI calls | First 500 users |
| Growth | $500 | ~150,000 AI calls | Up to 5,000 users |
| Scale | Custom | Based on revenue | Post-monetisation |

#### Budget Enforcement

```typescript
// Implemented in: supabase/functions/ai-proxy/index.ts

// On every AI call, the proxy:
// 1. Validates the caller's JWT
// 2. Checks per-user rate limits (rate_limits table)
// 3. Checks system-wide monthly call count (ai_budget table)
// 4. If either limit exceeded, returns { error, code } — no Gemini call made
// 5. If allowed, calls Gemini using GEMINI_API_KEY from Deno.env
// 6. Logs the call and increments usage counters
// 7. Returns { result } to the client
```

```sql
CREATE TABLE ai_budget (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month_key      TEXT NOT NULL,            -- e.g. '2025-07'
  total_calls    INTEGER NOT NULL DEFAULT 0,
  estimated_cost NUMERIC(10, 4) NOT NULL DEFAULT 0,
  budget_limit   NUMERIC(10, 2) NOT NULL,  -- set via env var
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (month_key)
);
```

#### Alert Thresholds

| Threshold | Action |
|---|---|
| 70% of monthly budget | Log warning; send alert to admin |
| 90% of monthly budget | Log critical alert; send urgent notification to admin |
| 100% of monthly budget | All AI calls return `AI_BUDGET_EXHAUSTED`; manual entry only for all users |
| Budget reset | Automatic on 1st of each month (new `month_key` row) |

#### Configuration

Budget limits are set as Supabase Edge Function environment variables (not EAS secrets):

```
GEMINI_API_KEY=...                    # Gemini API key — server-side only, never in client
AI_MONTHLY_BUDGET=100.00              # Monthly spend cap in USD
AI_BUDGET_ALERT_EMAIL=admin@halvy.app # Alert recipient
```

### 8.3 Monitoring

- **Daily AI call volume** — total OCR + voice calls across all users
- **Per-user AI call distribution** — identify power users and potential abuse
- **AI success rate** — percentage of calls producing usable results
- **Average cost per successful extraction** — actual spend ÷ successful parses
- **Budget burn rate** — projected month-end spend based on current daily average

---

## 9. File Locations Summary

| File | Responsibility |
|---|---|
| `src/features/ai/utils/geminiClient.ts` | AI proxy client — calls Edge Function, never Gemini directly |
| `src/features/ai/utils/imageProcessor.ts` | Receipt image pre-processing |
| `src/features/ai/utils/ocrPrompt.ts` | OCR prompt template builder |
| `src/features/ai/utils/ocrResponseParser.ts` | OCR JSON response parser |
| `src/features/ai/utils/voicePrompt.ts` | Voice prompt template builder |
| `src/features/ai/utils/voiceResponseParser.ts` | Voice JSON response parser |
| `src/features/ai/utils/memberMatcher.ts` | Fuzzy member name matching |
| `src/features/ai/hooks/useOCR.ts` | OCR flow state machine |
| `src/features/ai/hooks/useVoiceDictation.ts` | Voice dictation flow state machine |
| `src/utils/logger.ts` | Dev-mode AI debug logger |
| `src/utils/rateLimiter.ts` | Client-side rate limit checker (UX only — not authoritative) |
| `supabase/functions/ai-proxy/index.ts` | **Server-side Gemini proxy — the only file that holds the API key** |
