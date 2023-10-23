const { configure, presets } = require('eslint-kit')

module.exports = configure({
  mode: 'only-errors',
  presets: [
    presets.imports({
      sort: {
        newline: true,
        groups: [['^\\u0000'], ['^node:'], ['^'], ['^\\.']],
      },
    }),
    presets.typescript(),
    presets.prettier(),
    presets.node(),
    presets.react({ version: '18.0' }),
  ],
  extend: {
    rules: {},
  },
})
