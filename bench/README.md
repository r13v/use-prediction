# Typing with and without suggestions

This study measures whether `usePrediction` makes text entry faster, and which
features the first version needs.

## Method

- **Tasks.** Six realistic form texts in English and Russian, 179–248
  characters each: a support reply, a bug report, a cover letter, a grant
  summary, a delivery-delay reply, and a product description
  ([`tasks.ts`](tasks.ts)). The field label goes to the model as context.
- **Split.** The prompt in `examples/server.ts` was tuned on the two `tune`
  tasks. The results below come from the four `held-out` tasks only.
- **Model.** `gpt-6-luna` with `reasoning.effort: "none"` through the
  OpenAI-compatible endpoint at `LLM_BASE_URL`. The median latency was about
  2 s.
- **Simulated user.** [`compare.ts`](compare.ts) types into the stand page in
  Chromium at 220 ms per key. It pauses 250 ms after a space, 400 ms after a
  comma, and 1200 ms after a sentence (about 45 words per minute). It reads
  each new suggestion for 300 ms. It accepts a suggestion only if the
  suggestion matches the text that it intends to type.
- **Conditions.**
  - `off`: no suggestions.
  - `tab`: Tab accepts the whole suggestion.
  - `word`: Tab, or Cmd/Ctrl+→ to accept the matching words one at a time.
- **Metrics.**
  - KSR (keystroke savings rate): 1 − keystrokes / characters.
  - Time saved: modeled time (keys, pauses, and reading) compared with `off`.
  - Wasted: the share of shown suggestions that the user did not use.

## Results (held-out tasks)

| Condition | KSR | Time saved | Shown | Accepted | Wasted |
| --- | --- | --- | --- | --- | --- |
| `tab` | 2.8% | 1.5% | 12 | 2 | 83% |
| `word` | 8.3% | 6.3% | 14 | 8 | 43% |
| Abort on every keystroke | 0% | 0% | 0 | 0 | — |

The last row is an earlier version of the hook that aborted the request in
progress on each keystroke. At a latency of 2 s, the simulated user never
paused long enough, so no suggestion appeared in any of the six tasks.

On the tuning tasks, the results were similar. `tab` gave a KSR of 6.1%, and
`word` gave 9.7%.

## Decisions for the first version

| Feature | Decision | Evidence |
| --- | --- | --- |
| Keep the request in progress while the user types at the caret | Keep | Without it, no suggestions appeared at a latency of 2 s. |
| Shorten the suggestion while the user types it | Keep | Agreed before the study. Not measured separately. Without it, each typed character would hide the suggestion until the next answer, about 2 s later. |
| Word-by-word accept (Cmd/Ctrl+→) | Keep | +5.5 points of KSR on held-out tasks. The threshold was +5. |
| Tab, Escape, stale-response checks, `onError` | Keep | Required for correct behavior. They are not a speed feature. |
| A prompt that stops at the end of the clause and does not invent facts | Keep | Wasted `tab` suggestions on the tuning tasks went from 78% to 60%. |
| Streaming, response cache, confidence threshold | Do not add | Suggestions are short. The lost suggestions came from the model guessing content, not from transport. |

## Limits

- One simulated user with a fixed rhythm. Real people pause in different
  places and read at different speeds.
- An LLM helped write the target texts. A model can predict such text more
  easily than human text, so the real gain can be smaller.
- Only one latency level (about 2 s) was measured. A faster model gives more
  suggestions, but this study does not measure how many.
- Six tasks is a small sample. A difference of a few points can be noise.

## Run

```bash
npx vite --port 5180        # LLM_* variables in .env.local
npm run bench               # held-out tasks
npm run bench -- --split=all
```
