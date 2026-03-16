# ADR 004 — Separate textarea (input capture) from display div

**Date:** 2026-03-16
**Status:** Accepted

---

## Context

Text fading requires rendering each character as an individual DOM element so it can be independently animated. A plain `<textarea>` exposes its content as a single string — there is no way to attach animations to individual characters inside it.

At the same time, the `<textarea>` provides reliable, cross-browser keyboard input handling (including mobile keyboards, IME composition, and accessibility).

## Decision

In room mode, move the `<textarea>` off-screen (`position: fixed; top: -9999px`) and use a `<div id="display">` for all visible text. Each character is a `<span class="char">` inside the display div. The textarea remains focused so it continues to capture keyboard input normally.

## Rationale

- **Per-character animation:** individual `<span>` elements can be faded with CSS independently
- **Preserves input reliability:** the browser's native text input handling (keyboard events, IME, mobile) stays intact via the textarea
- **No virtual keyboard replacement:** building a custom keyboard handler would be fragile and inaccessible; keeping the textarea avoids this entirely

## Consequences

- Two sources of truth must be kept in sync: the `chars[]` array (floor holder) and the textarea value (`syncTextareaToChars()` is called after every mutation)
- The textarea's visual state (value, font, color) is never shown to the user in room mode — only the display div is visible
- Spectators render directly into `#display` without a textarea mirror, since they never hold the floor
