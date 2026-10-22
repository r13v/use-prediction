# CONTEXT.md format

`CONTEXT.md` is the product glossary and nothing else. It sets the canonical English terms for code, the public API, the README and other documents.

## Structure

```md
# {Context name}

{One or two sentences: what this context is and why it exists.}

## Language

**Suggestion**: {Definition of the term in one or two sentences.}
_Avoid_: Completion, prediction

**Ghost text**: {Definition.}
_Avoid_: Placeholder, hint
```

Use subheadings inside `## Language` only when the terms naturally fall into groups; otherwise use a flat list.

## Rules

1. **One term per concept.** If people use several words for a concept, choose the canonical one and list the others in `_Avoid_`. Separate similar concepts explicitly: each gets its own term and an `_Avoid_` with the neighbor's term (Suggestion and Ghost text).
2. **A definition is one or two sentences.** State what the concept is, not everything it does.
3. **Domain terms only.** General technical concepts, implementation details, requirements and architecture decisions do not go here: they have their own owners (`documentation-rules.md`). Before you add a term, ask: is the term unique to the domain of use-prediction, or is it a general concept?
4. **Language: English**, like all documentation. The public API and the README use glossary terms verbatim.
5. **A human decides the term.** Record a new term or a change of meaning after the user decides or explicitly delegates the choice.

## When to update

Update it in the same change as the code if the change:

- introduces a new domain entity or state that a user of the hook or of the field sees;
- renames an entity in the public API or the README;
- changes the meaning or boundary of a term (what belongs to the suggestion, what belongs to the ghost text);
- makes a word from `_Avoid_` necessary or finds a new competing word.

After a glossary edit, check that the public API, the README and the documents name the entity with the new term.
