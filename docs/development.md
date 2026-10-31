# Development

Use Node.js 24 and npm.

```bash
npm install
npm run test:react19:install  # React 19 copy for the test matrix
npm test                      # unit tests on React 18 and 19
npm run verify                # types, unit tests, Biome, Knip, package build and checks, site build
npm run test:e2e              # Chromium, Firefox, WebKit on React 18 and 19
npm run dev                   # stand; put LLM_* variables in .env.local
npm run site                  # the GitHub Pages site: live demo and README
npm run bench                 # comparison with and without suggestions
```

The site deploys from `main` through `.github/workflows/pages.yml`.
