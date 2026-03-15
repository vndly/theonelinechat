# ADR 002 — No framework, no bundler

**Date:** 2026-03-16  
**Status:** Accepted

---

## Context

The frontend needs to be simple, fast to load, and easy to contribute to. The application is a single page with minimal DOM interaction — a textarea, a hint line, a notification, and an overlay.

## Decision

Use **vanilla HTML, CSS, and JavaScript** with no framework (React, Vue, Svelte, etc.) and no bundler (Webpack, Vite, etc.).

## Rationale

- **Simplicity matches scope:** the UI is extremely minimal — one input, a few state classes. A framework would add more complexity than it removes
- **Zero build step:** `public/` is served directly. No compilation, no node_modules in the deploy artefact
- **Fast load:** no framework runtime to download; the JS is small and loads instantly
- **Low barrier to contribution:** anyone familiar with the web platform can read and modify the code without learning a framework

## Consequences

- No component model — HTML structure lives in `index.html`, styles in `style.css`, logic in `logic.js`
- No type safety — plain JS means no compile-time errors
- If the UI grows significantly in complexity, this decision should be revisited
- Firebase SDK is loaded from a CDN URL (`gstatic.com`) using ES module imports — no npm install required for the frontend
