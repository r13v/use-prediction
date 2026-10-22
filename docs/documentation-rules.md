# Documentation rules

Follow the spirit of Unix when you work with the documentation in `docs/` and with code comments.

- Document only what would surprise an experienced engineer who knows TypeScript, React, the DOM editing APIs (selection, `execCommand`, input events), Vite, Vitest and Playwright. Contracts and reasons, not a retelling of the code.
- When you update `docs/` or comments, bring them in sync with the project: remove stale and obvious text, update the surprises.
- Each topic has one owner document; the file name says which. Other documents refer to it and do not repeat it. A number or a limit lives in one place: the owner or the code.
- Describe the current state only. No history ("was", "used to", "previously", "no longer", "Done"), no run or ticket dates, no commit hashes. Support for old data is a current contract, not history; the migration notes of `README.md` are a contract for users of old versions.
- Do not describe an unimplemented item as working.
- A contract change updates its owner document in the same change.
- Give descriptive kebab-case file names: `tree docs` shows only the names.
- Assume the reader can grep and follow a path. Mention an npm script, a file or a function by name instead of retelling it.
- The full doc tree is in the context at the start of each session. Refer to a document by its file name in backticks when the name is unambiguous in the tree, for example `code-style-and-folders.md`; refer to its section as `code-style-and-folders.md` § Comments. Refer to any other file by its repo-root path without a leading slash, for example `lib/overlay.ts`. Do not use Markdown links or `../` paths for repository files. External URLs stay links. `README.md` and `bench/README.md` are for people and keep Markdown links.
- Every path exists and has no line number.
- Use the domain terms of `CONTEXT.md`; `glossary-format.md` says when to update it. Write in English for clarity (STE clarity mode): active voice, short sentences.
- No manual wrapping of lines in Markdown files in `docs/`, `AGENTS.md` and `CONTEXT.md`.
- No tables unless asked: use lists.
- `AGENTS.md` stays minimal: working rules, commands, invariants and the pointers that `tree docs` cannot show.

Before you commit a documentation edit:

- Every referenced path exists; only templates such as `<name>` may be missing: ``grep -ohE '`(docs|lib|src|e2e|examples|bench|scripts|test)/[^`]+`' AGENTS.md docs/*.md | tr -d '`' | sed 's/ §.*//' | sort -u | while read p; do ls -d "$p" >/dev/null 2>&1 || echo "missing: $p"; done``.
- No history: `grep -nE 'previously|used to|was changed|migrated|no longer|Done|Implemented|20[0-9]{2}-[0-9]{2}-[0-9]{2}' AGENTS.md CONTEXT.md docs/*` finds nothing new.
- No duplicates: grep all documents for the topic and keep the text only in its owner.
- `git diff --check`.
