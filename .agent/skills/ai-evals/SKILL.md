# Skill: AI Evals (PromptFoo)

**Source:** https://www.promptfoo.dev/docs/
**Version tested:** promptfoo 0.120.x
**Stack context:** Halvy — Gemini receipt parser + voice dictation evals

---

## When to Use This Skill

Use this skill when:
- Writing new AI prompt templates (`ai-evals/prompts/`)
- Adding test cases for OCR or voice dictation parsing
- Validating Gemini output quality after prompt changes
- Running regressions before shipping AI-powered expense entry

Never bypass evals when changing prompts. A prompt that "looks right" may regress
edge cases already covered by the eval suite.

---

## Directory Layout

```
ai-evals/
├── promptfooconfig.yaml          # Root config — providers + default assertions
├── prompts/
│   ├── receipt-extract.txt       # OCR system prompt template
│   └── voice-extract.txt         # Voice dictation prompt template
└── test-cases/
    ├── receipt-simple.yaml       # Single-page, clear receipt
    ├── receipt-tax-tip.yaml      # Tax + gratuity line items
    ├── receipt-low-confidence.yaml  # Blurry / partial receipt
    └── voice-multi-expense.yaml  # Multiple expenses in one utterance
```

---

## Root Config (`promptfooconfig.yaml`)

```yaml
# ai-evals/promptfooconfig.yaml
description: Halvy Gemini AI Parsing Evals

providers:
  - id: google:gemini-2.0-flash
    config:
      temperature: 0.1
      maxOutputTokens: 2048

prompts:
  - id: receipt-extract
    file: prompts/receipt-extract.txt
  - id: voice-extract
    file: prompts/voice-extract.txt

defaultTest:
  assert:
    - type: is-json
    - type: javascript
      value: |
        const parsed = JSON.parse(output);
        return (
          typeof parsed.total_cents === 'number' &&
          Number.isInteger(parsed.total_cents) &&
          typeof parsed.currency === 'string' &&
          Array.isArray(parsed.items)
        );

tests:
  - file: test-cases/receipt-simple.yaml
  - file: test-cases/receipt-tax-tip.yaml
  - file: test-cases/receipt-low-confidence.yaml
  - file: test-cases/voice-multi-expense.yaml
```

---

## Writing Test Cases

### Structure of a test case file

```yaml
# ai-evals/test-cases/receipt-simple.yaml
- description: Simple 3-item restaurant receipt, USD
  prompt: receipt-extract
  vars:
    receipt_image: "data:image/jpeg;base64,{{file('fixtures/receipt-simple.jpg')}}"
    currency: USD
  assert:
    # 1. Structural shape
    - type: is-json
    # 2. Total matches expected value
    - type: javascript
      value: |
        const r = JSON.parse(output);
        return r.total_cents === 2350;  // $23.50
    # 3. All items extracted (3 food items expected)
    - type: javascript
      value: |
        const r = JSON.parse(output);
        return r.items.filter(i => !i.is_tax && !i.is_tip).length === 3;
    # 4. Tax line identified
    - type: javascript
      value: |
        const r = JSON.parse(output);
        return r.items.some(i => i.is_tax);
```

### Tax + tip test case

```yaml
# ai-evals/test-cases/receipt-tax-tip.yaml
- description: Receipt with 8.875% tax and 18% auto-gratuity
  prompt: receipt-extract
  vars:
    receipt_image: "data:image/jpeg;base64,{{file('fixtures/receipt-tax-tip.jpg')}}"
    currency: USD
  assert:
    - type: is-json
    - type: javascript
      value: |
        const r = JSON.parse(output);
        const tax = r.items.find(i => i.is_tax);
        const tip = r.items.find(i => i.is_tip);
        return tax !== undefined && tip !== undefined;
    # Tax and tip must NOT be marked as regular items
    - type: javascript
      value: |
        const r = JSON.parse(output);
        const foodItems = r.items.filter(i => !i.is_tax && !i.is_tip);
        return foodItems.every(i => i.amount_cents > 0);
```

### Low-confidence test case

```yaml
# ai-evals/test-cases/receipt-low-confidence.yaml
- description: Partially obscured receipt — expects low confidence scores
  prompt: receipt-extract
  vars:
    receipt_image: "data:image/jpeg;base64,{{file('fixtures/receipt-blurry.jpg')}}"
    currency: USD
  assert:
    - type: is-json
    # At least one low-confidence item flagged (< 0.7)
    - type: javascript
      value: |
        const r = JSON.parse(output);
        return r.items.some(i => i.confidence < 0.7);
    # extractionFailed must be false even if confidence is low
    - type: javascript
      value: |
        const r = JSON.parse(output);
        return r.extractionFailed === false;
```

### Voice multi-expense test case

```yaml
# ai-evals/test-cases/voice-multi-expense.yaml
- description: Two expenses dictated in one utterance
  prompt: voice-extract
  vars:
    audio_transcript: "I paid $45 for dinner at Noma — split equally between me, Sara, and Khalid. Also $12 for coffee — just put that on me."
    members: "Ahmed, Sara, Khalid"
    currency: USD
  assert:
    - type: is-json
    # Two separate expenses parsed
    - type: javascript
      value: |
        const r = JSON.parse(output);
        return r.expenses.length === 2;
    # Dinner split has 3 participants
    - type: javascript
      value: |
        const r = JSON.parse(output);
        const dinner = r.expenses.find(e => e.total_amount === 45);
        return dinner && dinner.splits.length === 3;
    # Coffee is a solo expense
    - type: javascript
      value: |
        const r = JSON.parse(output);
        const coffee = r.expenses.find(e => e.total_amount === 12);
        return coffee && coffee.splits.length === 1;
```

---

## Expected Output Shape

All Gemini prompts must instruct the model to return this exact shape.
The eval assertions validate against it — never change the shape without updating tests.

```typescript
// Receipt parser output (src/features/ai/utils/ocrResponseParser.ts)
interface OcrEvalOutput {
  total_cents: number;         // integer — $23.50 → 2350
  currency: string;            // 'USD'
  extractionFailed: boolean;
  items: Array<{
    description: string;
    amount_cents: number;      // integer
    is_tax: boolean;
    is_tip: boolean;
    confidence: number;        // 0.0–1.0
  }>;
  warnings: string[];
}

// Voice parser output (src/features/ai/utils/voiceResponseParser.ts)
interface VoiceEvalOutput {
  expenses: Array<{
    title: string;
    total_amount: number;      // float OK for eval display; app converts to cents
    payer_user_id: string | null;
    splits: Array<{
      display_name: string;
      amount_owed: number;
    }>;
    confidence: number;
  }>;
  parseFailed: boolean;
  warnings: string[];
}
```

---

## Running Evals

```bash
# Run all evals
npm run test:ai-evals

# Run specific test file
npx promptfoo eval --config ai-evals/promptfooconfig.yaml \
  --filter-pattern "receipt-simple"

# Open interactive UI
npx promptfoo view

# Compare two prompt versions
npx promptfoo eval --config ai-evals/promptfooconfig.yaml \
  --prompts "prompts/receipt-extract-v1.txt" "prompts/receipt-extract-v2.txt"
```

---

## CI Integration

Evals run on CI only when AI-related files change (see `.github/workflows/test-full.yml`):

```yaml
on:
  push:
    paths:
      - 'ai-evals/**'
      - 'src/features/ai/**'
      - 'supabase/functions/ai-proxy/**'
```

This keeps CI fast — evals are slow and use real Gemini tokens.
Always run locally before pushing prompt changes.

---

## Adding a New Eval

1. Add prompt template to `ai-evals/prompts/` if it's a new prompt variant
2. Add fixture image/audio to `ai-evals/fixtures/` (base64 encoded or file reference)
3. Create test case YAML in `ai-evals/test-cases/`
4. Register it in `promptfooconfig.yaml` under `tests:`
5. Run `npm run test:ai-evals` and confirm it passes
6. Never ship a new prompt without at least 3 test cases: happy path, edge case, failure case

---

## Cost Awareness

Each eval run calls the real Gemini API. Budget per run: ~$0.01–0.05 depending on
test count and image sizes. Do not add evals with very large images (> 2MB each).

Track spend at: Gemini API Console → Usage → Requests by model.
