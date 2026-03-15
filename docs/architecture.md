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
A single HTML file with minimal markup: a `<textarea>` for input, a hint line, a notification bar, and an overlay for loading state.

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
- `updateChat({text, color, font, activeUser})` — writes the current line to the room node

**`utils.js`** — pure utility functions  
- Room ID generation: two adjectives + one noun (e.g. `flying-ancient-mustard`)
- OKLCH color generation: produces perceptually vivid, contrast-safe colors against the background using binary search over the lightness axis
- Contrast ratio / luminance helpers (WCAG-compliant)

---

## Data model (Firebase Realtime Database)

```
rooms/
  {roomId}/
    text: string          — current line being typed
    color: string         — hex color of the active user
    font: string          — font-family of the active user
    activeUser: string    — uid of whoever holds the floor
    users/
      {uid}/
        font: string
        color: string
```

Rooms are not explicitly deleted — they expire naturally (Firebase TTL or inactivity). No message history is ever written.

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
