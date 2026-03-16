# The One Line Chat · 1lc

> A keyboard-first, ephemeral chat that transposes spoken conversation into text.

**Live:** [theonelinechat.web.app](https://theonelinechat.web.app)

---

## What is 1lc?

1lc is a minimal chat tool built around one constraint: **only one line of text exists at a time.**

There is no history. No accounts. No scrolling back. Just the current line — like words in a conversation that dissolve as they're spoken.

**Core principles:**
- Everything is keyboard-driven — no mouse required
- A room can be created and shared in seconds
- Only the current line being typed is ever visible
- Text fades over time, mirroring how spoken words vanish
- No conversation is ever stored
- Features serve the chat only — no analytics, no side panels

---

## How it works

### Creating a room
1. Visit the homepage
2. Press `Enter` — a room is created instantly, its name copied to your clipboard
3. Share the name (e.g. `flying-ancient-mustard`) with whoever you want to chat with

### Joining a room
- Navigate directly to `theonelinechat.web.app/flying-ancient-mustard`, or
- Type the room name on the homepage and press `Enter`

### In the room
- Press `Enter` to take the floor and start typing
- Only one person types at a time — others see your text live
- Each user gets a unique color and font (their "voice")
- Text fades after a set time and character limit *(planned — not yet implemented)*

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML / CSS / JavaScript (no framework) |
| Realtime sync | Firebase Realtime Database |
| Hosting | Firebase Hosting |
| Color generation | OKLCH perceptual color space |
| Tests | Node.js built-in test runner |

No build step. No bundler. The `public/` folder is served as-is.

---

## Project structure

```
public/
  index.html    — single page, minimal markup
  logic.js      — routing, room/homepage logic, UI state
  firebase.js   — Firebase Realtime Database interface
  utils.js      — room ID generation, color math (OKLCH)
  style.css     — layout and visual styling
test/
  utils.test.js — unit tests for utils
docs/
  architecture.md        — system design overview
  contributing.md        — how to contribute
  decisions/             — Architecture Decision Records (ADRs)
```

---

## Running locally

No install needed for the frontend — just open `public/index.html` in a browser, or use any static server:

```bash
npx serve public
```

To run against a real Firebase instance, you'll need Firebase credentials. See [docs/contributing.md](docs/contributing.md).

**Tests:**
```bash
npm test
```

---

## Documentation

- [Architecture](docs/architecture.md) — how the system is structured and why
- [Contributing](docs/contributing.md) — setup, conventions, PR process
- [Decisions](docs/decisions/) — Architecture Decision Records

## Open issues & roadmap

Tracked in [GitHub Issues](https://github.com/vndly/theonelinechat/issues). Key open threads:
- [v.1 UX spec](https://github.com/vndly/theonelinechat/issues/2)
- [Room creation](https://github.com/vndly/theonelinechat/issues/6)
- [User identity — color and font](https://github.com/vndly/theonelinechat/issues/5)
- [Text fading](https://github.com/vndly/theonelinechat/issues/9)
