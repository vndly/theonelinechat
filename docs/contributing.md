# Contributing

## Prerequisites

- A modern browser (for local testing)
- Node.js (for running tests)
- Firebase CLI (for deployment only): `npm install -g firebase-tools`

---

## Local development

No build step required. The `public/` folder is served as-is.

**Quickest way:**
```bash
npx serve public
```

Then open [http://localhost:3000](http://localhost:3000).

> Note: some features (room creation, real-time sync) require a live Firebase connection. For local development against the real Firebase instance, you'll need to be added to the project — ask a maintainer.

---

## Running tests

```bash
npm test
```

Uses the Node.js built-in test runner. Tests live in `test/`.

---

## Branch conventions

| Prefix | Use for |
|--------|---------|
| `feat/` | New features |
| `fix/` | Bug fixes |
| `docs/` | Documentation only |
| `refactor/` | Code changes with no behaviour change |
| `test/` | Adding or updating tests |

Example: `feat/room-background-color`

---

## Pull requests

- Keep PRs focused — one concern per PR
- Reference the related issue in the PR description (e.g. `Closes #6`)
- PRs to `main` require at least one review
- Avoid committing directly to `main`

---

## Deployment

Deployment is manual and restricted to maintainers:

```bash
firebase deploy
```

This deploys both hosting (`public/`) and database rules (`database.rules.json`).

---

## Code style

- Vanilla JS — no framework, no TypeScript
- No build tools or bundlers
- Prefer small, focused modules
- Pure functions go in `utils.js`; Firebase calls go in `firebase.js`; UI/routing logic goes in `logic.js`
- Keep `index.html` minimal — no logic in markup
