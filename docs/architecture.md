# Architecture

## Overview

1lc is a single-page web application with no backend server. All real-time state is managed through Firebase Realtime Database. The frontend is plain HTML, CSS, and JavaScript — no framework, no bundler.

```
Browser (user A)                Browser (user B)
     |                               |
  logic.js                        logic.js
     |                               |
  firebase.js ──── Firebase RTDB ── firebase.js
                   (rooms/{id})
```

---

## Frontend

**Entry point:** `public/index.html`
A single HTML file with minimal markup: a `<textarea>` (off-screen in room mode, used only for keyboard capture), a `#display` div (visible text in room mode), a hint line, a notification bar, and an overlay for loading state.

**`logic.js`** — main application logic  
Handles two modes depending on the URL path:
- **Homepage mode** (`/`): listens for `Enter` to create or join a room
- **Room mode** (`/:roomId`): registers the user, subscribes to Firebase, manages the floor mechanic

**`firebase.js`** — database interface  
Thin wrapper over the Firebase SDK. Exports:
- `setRoom(roomId)` — sets the active room reference
- `registerUser(roomId, uid, font, color)` — writes user identity into `rooms/{id}/users/{uid}`
- `getTakenFonts(roomId, uid)` — reads fonts already assigned to other users
- `listenChat(callback)` — subscribes to room state changes
- `updateChat({text, color, font, activeUser, claimedAt})` — writes the current line to the room node

**`utils.js`** — pure utility functions  
- Room ID generation: two adjectives + one noun (e.g. `flying-ancient-mustard`)
- OKLCH color generation: produces perceptually vivid, contrast-safe colors against the background using binary search over the lightness axis
- Contrast ratio / luminance helpers (WCAG-compliant)

---

## Data model (Firebase Realtime Database)

```
rooms/
  {roomId}/
    text: string          — current line being typed (faded chars removed)
    color: string         — hex color of the active user
    font: string          — font-family of the active user
    activeUser: string    — uid of whoever holds the floor
    claimedAt: number     — Lamport timestamp of the current floor claim
    users/
      {uid}/
        font: string
        color: string
```

Rooms are not explicitly deleted — they require a manual cleanup mechanism (Firebase Realtime Database has no built-in TTL). No message history is ever written.

---

## User identity

Users are anonymous. Identity is stored in `localStorage`:
- `uid` — random alphanumeric string, generated once per browser
- `font` — assigned from a fixed pool of 5 fonts; avoids collisions with other room participants
- `color` — generated via OKLCH to be visually distinct and contrast-safe against the room background

---

## The floor mechanic

Only one user types at a time. The active typist is tracked via `activeUser` in the room node:
- Pressing `Enter` claims the floor and clears the line
- Other users see the text live but their input is disabled
- First keystroke also claims the floor if it's unclaimed

Floor claims include a `claimedAt` Lamport timestamp (`Math.max(Date.now(), lastSeenClaimedAt + 1)`) to ensure monotonicity. Incoming broadcasts with a lower `claimedAt` than the last seen value are discarded as stale, preventing race conditions when two users claim the floor near-simultaneously.

---

## Text fading

Each character typed by the floor holder is tracked individually in a `chars` array with its insertion timestamp. Two independent triggers cause a character to fade:

1. **Time-based:** a character that has been visible for `FADE_TIMEOUT_MS` (default: 10 seconds) starts fading
2. **Rolling window:** when the number of active (non-fading) characters reaches `FADE_CHAR_THRESHOLD` (default: 200), the oldest active character is immediately faded

Fading is a CSS animation (`char-fade`, 0.6s ease-out). After the animation completes, the character is removed from `chars` but its DOM `<span>` is kept as an invisible ghost to avoid layout shifts while other chars are still visible. The display and font size reset only once all characters have faded.

**Spectator sync:** spectators receive the text string (faded chars already stripped) via Firebase. `renderStaticDisplay()` diffs the incoming string against the previously rendered state to mirror fading gracefully — avoiding full re-renders on every keystroke.

---

## Dynamic font size

The text display starts at `FONT_SIZE_DEFAULT` (10em). After every character addition, removal, or window resize, `adjustFontSize()` runs inside a `requestAnimationFrame` callback:

1. Measure `displayElement.scrollHeight` vs `window.innerHeight`
2. If the content overflows, scale down: `newSize = currentSize × (windowHeight / contentHeight)`
3. Apply the new size — floored at `FONT_SIZE_MIN` (1em)

The font size only ever shrinks while text is present. It resets to the default when the display is fully cleared (all chars faded or `Enter` pressed). This applies to both the floor holder (character-level tracking) and spectators (on each Firebase update).

---

## Hosting & deployment

Hosted on Firebase Hosting. The `public/` directory is served statically with a catch-all rewrite to `index.html` (enabling direct room URL navigation).

```json
"rewrites": [{ "source": "**", "destination": "/index.html" }]
```

Deploy: `firebase deploy`

---

## Testing

Unit tests live in `test/utils.test.js` and use the Node.js built-in test runner (`node --test`). They cover the pure utility functions in `utils.js` — color math, room ID generation, sanitisation.

No integration or end-to-end tests yet.
