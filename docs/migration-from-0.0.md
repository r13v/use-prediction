# Migration from 0.0.x

- `get(value, controller)` is now `get({ text, before, after, signal })`.
- The `color` and `style` options are removed. Use `className`.
- `ref` is a callback ref. You can merge it with other refs.
