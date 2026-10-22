# Code style

Priorities: readability, simplicity, maintainability. Biome (`biome.json`) checks formatting and the lint rules; review checks the other rules.

## Readability

1. **Separate steps with a blank line.** A guard clause, a computation and a result are separate paragraphs. Put a blank line before the final `return`, except in a block with a single statement.
2. **Name the result.** Assign a multi-line expression to a variable with a domain name, then return the variable.
3. **Keep ternaries short.** The condition is a variable or a call; the branches are simple values. Do not use a ternary after a multi-line expression.
4. **Use early return.** Remove unsuitable cases before the main scenario.
5. **Destructure a repeated path.** Instead of `caret.before`, `caret.after` in many places, write `const { before, after } = caret`.

## Simplicity

6. **Access data directly.** For the last N items, use `slice(-N)`; for the last item, use `at(-1)`. Do not compute an array of indexes to iterate over them.
7. **Do not nest callbacks deeper than one level.** Move a callback with several steps or with its own callback to a named function.
8. **Do not create abstractions for the future.** Extract a function or a constant for reuse or to name a non-obvious step. Do not add wrappers for future flexibility.

## Maintainability

9. **Name complex conditions.** For example, move a check that the caret has text after it on its line to a named variable.
10. **Name non-obvious literals.** A delay, a limit and a style get a constant near their use.
11. **Explain the reason in a comment.** The code and the names must make the action clear.
12. **Keep a helper next to its only user.** Field helpers that the controller and the overlay share live in `lib/field.ts`; do not create copies.
13. **Keep the package small.** `lib` has no runtime dependencies except the React peer dependency; the build marks every dependency as external (`tsdown.config.ts`).
14. **Update dependencies deliberately.** Choose current stable versions, check compatibility and update the lockfile. Do not update the whole stack as part of an unrelated task.

## Code structure

- `lib` — the npm package. `lib/use-prediction.ts` is the public entry: the hook and the exported types. `lib/controller.ts` holds `PredictionController`: requests, state, keys and the caret checks of one field. `lib/overlay.ts` draws the ghost text and the loading indicator. `lib/field.ts` reads the caret and inserts text. Unit tests live next to the code as `*.test.ts(x)` and run in jsdom.
- The overlay is plain DOM outside React. It goes into `document.body`, or into the open `<dialog>` or popover that holds the field, and copies the text styles of the field so that its glyphs land on the glyphs of the field. It sets only inline styles and animates through the Web Animations API.
- The controller notifies React after the current event, never inside a native listener: a render inside the listener writes the old value back into a controlled field.
- `src` — the stand: a Vite page with the fields that the e2e tests and manual checks use (`src/stand.tsx`, `src/form-please-demo.tsx`). `src/predict.ts` calls `/api/predict`; `?predict=off` renders the fields without suggestions.
- `examples/server.ts` — the example prediction endpoint for readers to copy; `vite.config.ts` serves it at `/api/predict` for the stand. `cleanSuggestion` fixes the slips of the model before the answer reaches the hook.
- `e2e` — Playwright tests on the stand in Chromium, Firefox and WebKit on React 18 and 19 (`playwright.config.ts`).
- `test/react-19` — the React 19 copy for the test matrix; `REACT_VERSION=19` makes `vite.config.ts` resolve React from it.
- `bench` — the comparison of typing with and without suggestions; see `bench/README.md`.
- `scripts/verify-release.mjs` — the release guard of the publish workflow.

## Comments

Check all comments and JSDoc within the scope of the task. Do not extend the cleanup to adjacent code, and do not add comments where there were none.

Keep information that the code, names and types do not show:

- the reason for a decision, an external constraint or a workaround with a link to an issue or a specification;
- an invariant, an order of actions, concurrency or safety conditions;
- a unit of measurement, a format or an API contract;
- a current TODO with an owner or an issue.

Remove retelling of the code or the signature, history and development steps, commented-out code, empty separators, and done or ownerless TODOs.

Describe the current state briefly; keep conditions, limits and links. For example: "Notify after the current event: a render inside the input listener swallows the keystroke." Support for old data is a current contract, not change history.

Keep licenses, copyright, shebangs, directives (`biome-ignore`, `@ts-expect-error`, `@ts-ignore`, pragmas such as `@vitest-environment`), machine annotations, executable examples and mandatory documentation. The JSDoc of the public API in `lib` is mandatory: the package types ship it to users. You can shorten the content of mandatory JSDoc; do not change the syntax of directives.

If a comment contradicts the code, fix it when the requirements are confirmed. If they are uncertain, report the conflict as MEDIUM and do not guess. Retelling, history and commented-out code are HIGH.

After the cleanup, check that the executable code did not change. For TypeScript, run `npm run verify`; for documentation, run `git diff --check`. Comment cleanup does not need new tests.

## Example

A guard clause, a named condition and a named result:

```ts
const DEBOUNCE_MS = 300

function scheduleAt(caret: Caret, now: number) {
	if (caret.before.trim() === "") return null

	const textAfterOnLine = /^[^\n]*\S/.test(caret.after)
	const runAt = now + DEBOUNCE_MS

	return { runAt, textAfterOnLine }
}
```

The request waits until the user pauses; an empty text before the caret has nothing to continue.
