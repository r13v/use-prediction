# use-prediction

Inline AI suggestions for your existing React `<input>` and `<textarea>`
fields. The user types, a suggestion appears as gray "ghost" text at the caret,
and Tab inserts it.

- **Any provider.** You give the hook an async `get` function. The hook does
  not call an AI provider itself.
- **Any UI kit.** The hook needs only the native element through a `ref`. It
  works with controlled fields, form libraries, and component libraries.
- **Native editing.** Accepted text goes through the browser's own insertion,
  so React `onChange` runs and Undo works.

React 18 and React 19 are supported.

## Installation

```bash
npm install use-prediction
```

## Usage

```tsx
import { usePrediction } from "use-prediction"

export const Message = () => {
  const prediction = usePrediction({
    get: async ({ before, after, signal }) => {
      const response = await fetch("/api/predict", {
        method: "POST",
        body: JSON.stringify({ before, after }),
        signal,
      })
      const { suggestion } = await response.json()
      return suggestion
    },
  })

  return <textarea ref={prediction.ref} />
}
```

Your server sends the text to the model and returns the suggestion. Keep the
API key on the server. For a complete server with the OpenAI SDK, see
[`examples/server.ts`](examples/server.ts).

## How it behaves

| Action | Result |
| --- | --- |
| The user stops typing for `debounce` ms | The hook calls `get` with the text before and after the caret. |
| The user types the first characters of the suggestion | The suggestion gets shorter. There is no new request. |
| The user keeps typing at the caret while a request is in progress | The hook waits for the response and shows the part that the user did not type yet. |
| Cmd+→ (macOS) or Ctrl+→ | Inserts the next word of the suggestion. The rest stays visible. |
| The user types other text, deletes text, or moves the caret | The suggestion disappears, and the hook aborts the request. |
| The value changes without typing, for example a form reset | The suggestion disappears. |
| Tab | Inserts the suggestion. When there is no suggestion, Tab moves focus as usual. |
| Escape | Hides the suggestion. While a suggestion is visible, Escape does not close a dialog that contains the field. |
| Blur, IME composition | Hides the suggestion. |

The hook shows a response only if the text and the caret did not change since
the request, or if the user only typed the first characters of the response.
It aborts the `signal` of a request that can no longer be used.

The hook works with `<textarea>` and with `<input>` of type `text`, `search`,
`tel`, and `url`. For other inputs, such as `password` or `email`, it does
nothing.

## API

```ts
const prediction = usePrediction({
  // Required. Returns the text to insert at the caret, or "".
  get: ({ text, before, after, signal }) => Promise<string>,
  // Delay after the last keystroke, in ms. Default: 300.
  debounce: 300,
  // Class name of the ghost text. Default: the field's text color at 45% opacity.
  className: "my-ghost",
  // Called when get fails. The field keeps working without a suggestion.
  // Default: console.error.
  onError: (error) => {},
})

prediction.ref // Ref callback for the native <input> or <textarea>.
prediction.status // "idle" | "loading" | "ready"
prediction.suggestion // The visible suggestion, or "".
prediction.accept() // Inserts the suggestion. Returns false when there is none.
prediction.dismiss() // Hides the suggestion and cancels the request.
```

Use `status`, `suggestion`, and `accept` to build your own hints, for example
a "Tab" badge or an accept button on touch devices. A button must keep the
focus in the field. Otherwise, the field loses focus and the suggestion
disappears before the click:

```tsx
{prediction.suggestion && (
  <button
    type="button"
    onPointerDown={(event) => event.preventDefault()}
    onClick={prediction.accept}
  >
    Accept
  </button>
)}
```

## Use with a UI kit or a form library

Give `prediction.ref` to the native element. If the component already uses a
ref, call both refs from one callback:

```tsx
// React Hook Form
const { ref, ...field } = register("summary")

<textarea
  {...field}
  ref={(node) => {
    ref(node)
    prediction.ref(node)
  }}
/>
```

```tsx
// MUI: the ref must point to the native element, not to the root <div>.
<TextField
  multiline
  slotProps={{ htmlInput: { ref: prediction.ref } }}
/>
```

```tsx
// form-please: a custom control
const PredictedTextarea = ({ value, setValue, blur, input, props }) => {
  const prediction = usePrediction({ get: props.predict })

  return (
    <textarea
      id={input.id}
      name={input.name}
      value={value ?? ""}
      onChange={(event) => setValue(event.currentTarget.value)}
      onBlur={blur}
      ref={(node) => {
        input.ref(node)
        prediction.ref(node)
      }}
    />
  )
}
```

An inline callback like the ones above is safe. React gives a new callback on
each render, and the hook keeps the same field attached.

## Limits

- The ghost text is an overlay in `document.body`, or in the open `<dialog>` or
  popover that contains the field. When a scroll container cuts off part of the
  field, the overlay is not cut off.
- When the caret is in the middle of the text, the field hides its own text
  while the suggestion is visible, and the overlay shows the full text.
- In Safari, one Undo can remove the accepted suggestion together with the text
  typed just before it.
- When `execCommand("insertText")` is not available, the hook sets the value
  and sends an `input` event. React still sees the change, but Undo does not
  include it.

## Migration from 0.0.x

- `get(value, controller)` is now `get({ text, before, after, signal })`.
- The `color` and `style` options are removed. Use `className`.
- `ref` is a callback ref. You can merge it with other refs.

## Development

```bash
npm install
npm run test:react19:install  # React 19 copy for the test matrix
npm test                      # unit tests on React 18 and 19
npm run test:e2e              # Chromium, Firefox, WebKit on React 18 and 19
npm run dev                   # stand; put LLM_* variables in .env.local
npm run bench                 # comparison with and without suggestions
```
