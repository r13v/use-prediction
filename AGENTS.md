# use-prediction: instructions for coding agents

use-prediction is a React hook that shows AI suggestions as ghost text in an existing `<input>` or `<textarea>` and inserts them on Tab. The npm package is built from `lib`; the rest of the repository is the stand, the example server, tests and the bench. These rules apply to the whole checkout. Work from the repository root.

## Working rules

1. **Think before coding.** State the significant assumptions and the success criteria. Research the available facts yourself; if an ambiguity changes the task result, ask. Propose a simpler solution when it solves the task.
2. **Simplicity first.** Write the minimum code for the current task, without features for the future and without one-time abstractions. Before you write your own implementation, check the standard capabilities of React and the DOM editing APIs.
3. **Surgical changes.** Change only what is necessary. Keep existing user changes, including staged ones. Do not include adjacent fixes and refactoring in the task.
4. **Goal-driven execution.** Bring the result to verification. Fix the errors that your change causes, run the affected checks again and report their limits.
5. **Surface conflicts.** Do not mix contradictory models. Explain why you chose the more current or better-verified approach; mark any remaining contradiction explicitly.
6. **Read before writing.** Before a change, read the affected exports, their direct consumers and the shared utilities. Do not replace a contract that you do not understand with a guess.
7. **Test intent.** Test the domain reason for the behavior: a test must catch a broken invariant, not reproduce the implementation. Do not add an artificial test for a simple text edit.
8. **Match conventions.** Follow the existing patterns and Biome. Discuss a harmful convention explicitly; do not silently create a second style.
9. **Keep the glossary current.** When a change adds or renames a domain term or changes its meaning, update `CONTEXT.md` in the same change, as `glossary-format.md` specifies.

## Commands and checks

Use Node.js 24 (the version of CI), npm and local dependencies: `npm ci`, then `npm run test:react19:install` for the React 19 copy in `test/react-19`. `prepare` installs the lefthook hooks.

- During work: run only the checks that the change needs, and only on the changed files: `npx --no-install biome check <files>`, `npx --no-install vitest run <test files>`, and `npm run typecheck` when types or exports change. A documentation-only edit needs no code checks. Do not format unrelated files.
- At the end of the task, once: `npm run verify` — TypeScript, unit tests on React 18 and 19, Biome, Knip, the package build and the package checks.
- When the change affects the hook, the overlay or the stand, also run `npm run test:e2e` at the end.
- Run checks without approval. Checks never call a model: unit tests replace `get`, and e2e tests answer `/api/predict` with `page.route`. Only `npm run bench` and the stand with `LLM_*` variables in `.env.local` call a real model.

## Documentation

Always run `tree docs` at the beginning (without `tree`: `find docs -name '*.md' | sort`) to get an overview of durable documents; the file names say what each one owns. Before you change code, read `code-style-and-folders.md`. Before you change documentation, read `documentation-rules.md`. `README.md` owns the public API and the behavior that users see; `bench/README.md` owns the method and the results of the bench.

## Invariants

- The hook never calls an AI provider. The prediction source of the consumer does, and an API key stays on the server.
- The overlay never moves the text of the field. It covers the text of the field only while it draws a suggestion in the middle of the text; then the field hides its own glyphs and the overlay draws the whole text.
- An accepted suggestion goes through the native editing command of the browser, so React `onChange` runs and Undo works.
- The hook shows an answer only if the text and the caret did not change since the request, or if the user only typed the first characters of the answer. It aborts the `signal` of a request whose answer it cannot use.
- `lib` runs in the browser: no Node.js APIs and no stylesheet injection, so a strict CSP does not break it.
- The package supports React 18 and 19; unit and e2e tests run on both.
