# use-prediction

Copilot-style AI suggestions for the `<input>` and `<textarea>` you already
have. The user types, a suggestion appears as gray ghost text at the caret,
and Tab inserts it.

**[Try the live demo →](https://r13v.github.io/use-prediction/)**

```tsx
const prediction = usePrediction({ get: fetchSuggestion })

return <textarea ref={prediction.ref} />
```

- **Keep your field.** No editor to adopt: the hook needs one ref on the
  native element. Controlled fields, React Hook Form, MUI and other UI kits
  work as they are.
- **Any model.** You write `get`; the hook never calls an AI provider itself,
  so your API key stays on your server.
- **Native editing.** Accepted text goes through the browser's own insertion:
  React `onChange` runs and Undo works.
- **The hard parts are done.** Debounce, aborts of stale requests, typing
  through a suggestion without a new request, suggestions in the middle of
  the text, IME, modal dialogs and right-to-left text.
- **Small and CSP-safe.** About 6 KB gzipped, no runtime dependencies, no
  injected stylesheet. React 18 and 19.

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

Your server sends the text to the model and returns the suggestion. For a
complete server with the OpenAI SDK, see [`examples/`](examples).

## How it behaves

| Action | Result |
| --- | --- |
| The user stops typing for `debounce` ms | The hook calls `get` with the text before and after the caret. A loading indicator appears at the caret. |
| The user types the first characters of the suggestion | The suggestion gets shorter. There is no new request. |
| Tab | Inserts the suggestion. Without a suggestion, Tab moves focus as usual. |
| Cmd+→ (macOS) or Ctrl+→ | Inserts the next word. The rest stays visible. |
| Escape | Hides the suggestion. While a suggestion is visible, Escape does not close the dialog that contains the field. |
| Other typing, deletion, a caret move, blur, IME composition, or a value change without typing | Hides the suggestion and aborts the request. |

The hook shows a response only if the text and the caret did not change since
the request, or if the user only typed the first characters of the response.
It works with `<textarea>` and with `<input>` of type `text`, `search`, `tel`
and `url`; for other inputs it does nothing.

## API

```ts
const prediction = usePrediction({
  // Required. Returns the text to insert at the caret, or "".
  get: ({ text, before, after, signal }) => Promise<string>,
  // Delay after the last keystroke, in ms. Default: 300.
  debounce: 300,
  // Class name of the ghost text. Default: the field's text color at 45% opacity.
  className: "my-ghost",
  // Shows a loading indicator at the caret while get runs. Default: true.
  loading: true,
  // Class name of the loading indicator. Default: a thin shimmering line under the text.
  loadingClassName: "my-loading",
  // Called when get fails. The field keeps working. Default: console.error.
  onError: (error) => {},
})

prediction.ref // Ref callback for the native <input> or <textarea>.
prediction.status // "idle" | "loading" | "ready"
prediction.suggestion // The visible suggestion, or "".
prediction.accept() // Inserts the suggestion. Returns false when there is none.
prediction.dismiss() // Hides the suggestion and cancels the request.
```

Use `status`, `suggestion` and `accept` for your own hints, such as a "Tab"
badge or an accept button on touch devices. The button must keep the focus in
the field, or the suggestion disappears before the click:

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
ref, call both refs from one callback. An inline callback is safe: the hook
keeps the same field attached across renders.

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

## Custom loading indicator

The built-in indicator is a thin line under the text that starts at the caret
and runs forward in the field's text color. It never moves or covers the text,
and its highlight stops when the user prefers reduced motion.

A class in `loadingClassName` replaces the built-in size, color and animation.
The element sits in a zero-size box at the caret on the text baseline; move it
with `bottom` and `inset-inline-start`, so it also works in right-to-left
fields. The box has `data-use-prediction-loading="middle"` when the line has
text after the caret, and `"end"` otherwise. Add your own reduced-motion rule:

```css
.my-loading {
  bottom: 0.05em;
  inset-inline-start: 0.3em;
  width: 0.5em;
  height: 0.5em;
  border-radius: 50%;
  background: currentcolor;
  animation: my-pulse 1s ease-in-out infinite alternate;
}

[data-use-prediction-loading="middle"] > .my-loading {
  bottom: -0.4em;
  inset-inline-start: 0;
}

@keyframes my-pulse {
  from {
    opacity: 0.25;
  }
}

@media (prefers-reduced-motion: reduce) {
  .my-loading {
    animation: none;
  }
}
```

To show no indicator, set `loading: false` and use `prediction.status`.

## Limits

- The ghost text is an overlay in `document.body`, or in the open `<dialog>`
  or popover that contains the field. A scroll container that cuts off the
  field does not cut off the overlay.
- When the caret is in the middle of the text, the field hides its own text
  while the suggestion is visible, and the overlay shows the full text.
- In Safari, one Undo can remove the accepted suggestion together with the
  text typed just before it.
- When `execCommand("insertText")` is not available, the hook sets the value
  and sends an `input` event. React sees the change, but Undo does not include
  it.

## More

- [Migration from 0.0.x](docs/migration-from-0.0.md)
- [Development](docs/development.md)
- [Changelog](CHANGELOG.md)

MIT License
