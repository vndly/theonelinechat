# ADR 003 — OKLCH for user color generation

**Date:** 2026-03-16  
**Status:** Accepted

---

## Context

Each user in a room needs a distinct, readable color that serves as their "voice" — visually distinguishing their text from others. Colors must:
- Be visually vivid and varied (not all pale or all dark)
- Meet WCAG contrast requirements against the room background
- Be generated client-side without a server

## Decision

Generate user colors in the **OKLCH perceptual color space**, then binary-search for the lightness value that hits the required WCAG contrast ratio against the current background.

## Rationale

- **Perceptual uniformity:** in OKLCH, equal chroma values look equally vivid across all hues (unlike HSL, where yellow and blue at the same saturation look very different in practice)
- **Contrast guarantee:** binary search over the lightness axis reliably finds a color that meets the target contrast ratio (WCAG AA Large: 3:1)
- **No server needed:** entirely client-side math — no API call, no color palette to maintain
- **Flexible against any background:** the algorithm adapts to whatever background color the room uses

## Consequences

- The color math (`oklchToHex`, `findOKLCHLightness`) is non-trivial and lives in `utils.js` — it is well-commented and covered by tests
- Near-gamut-boundary colors can cause rare non-monotonicity in the lightness→luminance curve; handled by a retry loop (up to 10 attempts) with an achromatic fallback
- Colors are generated once per user session and stored in `localStorage` — they persist across page reloads
