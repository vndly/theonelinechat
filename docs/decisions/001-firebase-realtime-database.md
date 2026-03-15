# ADR 001 — Firebase Realtime Database for room state

**Date:** 2026-03-16  
**Status:** Accepted

---

## Context

1lc requires real-time synchronisation of a single shared text line between up to 5 users in a room. The requirements are:
- Sub-second latency for live text updates
- No persistent storage of conversation history
- No backend server to maintain
- Simple data model (one active line per room)

## Decision

Use **Firebase Realtime Database** for all room state.

## Rationale

- **No server required:** Firebase handles the WebSocket infrastructure, eliminating the need to run and maintain a backend
- **Simple data model fit:** the room state is a flat object (`text`, `color`, `font`, `activeUser`) — a perfect match for RTDB's JSON tree
- **Real-time by default:** `onValue` listeners push updates to all clients instantly with no polling
- **Free tier sufficient:** at current scale, the Spark plan covers all usage

## Consequences

- The project is coupled to Firebase. Migrating away would require replacing `firebase.js` and the data model
- Firebase Realtime Database is a proprietary service — no self-hosting option
- All clients connect directly to the database; there is no server-side validation layer beyond database rules
- Room data is not explicitly deleted — relies on Firebase TTL or manual cleanup
