# Ludo Arena

Ludo feature for the web app with gameplay, accessibility, and peer lifecycle improvements. It is registered at `/ludo` and `/ludo/room/:code` (public routes in `apps/web/src/App.tsx` via `apps/web/src/pages/LudoPage.tsx`). All code, styles, and tests live inside this folder; styles are scoped under `.ludo-arena` so no other page is affected.

## Game modes

- **Solo Arena** — 1–3 tactical bots with a real turn clock.
- **Pass & Play** — 2–4 players on one device with a privacy handoff screen.
- **Online Room** — peer-hosted (PeerJS/WebRTC) friend rooms; the host's browser runs the match.

## Rules implemented

Six to leave the yard, extra roll on a six, three sixes lose the turn, safe stars, captures, two-token blockades, exact-finish home entry, optional ranked finish, 30-second turns. Path progress is zero-based: ring `0–50`, private home lane `51–55`, finish `56` (`game/types.ts`).

## Online rooms (peer-hosted, friends-only)

- Creating a room generates a five-digit code **plus a private 48-hex invite secret**. Share the full invite link (`/ludo/room/12345?invite=…`); the number alone only joins code-only rooms.
- Guests receive a host-assigned seat key and a 192-bit resume token kept **in memory only** (never storage). An unexpected disconnect reserves the seat for 90 seconds; the **Reconnect** button reclaims it. Refreshing the page clears recovery credentials.
- All peer traffic is validated (Zod schemas, packet size/traversal bounds, per-connection rate limits, handshake deadlines). Guests cannot supply dice values or authoritative action timestamps; actions carry match ID + expected revision. Guests receive validated host snapshots.
- The PeerJS room id namespace is `ludo-arena-v2-<code>`, which separates this protocol from legacy peers.

**Honest limitations:** the host's browser must stay open; a modified host client can still cheat (there is no server referee); there is no host migration or durable room recovery; restrictive networks may fail without a TURN relay. Trusted play requires implementing and deploying a server following [`server-contract/README.md`](./server-contract/README.md); that document is a design contract, not a working server.

## Development

```sh
# from apps/web — run the Ludo test suite
node ../../node_modules/vitest/vitest.mjs run src/features/ludo

# isolated preview server (port 5199), from apps/web
npx vite --config vite.ludo.config.ts
```

## Compatibility and release checks

The `v2` PeerJS namespace prevents connecting to legacy rooms. Snapshots containing position `57` are rejected; other legacy snapshots are not automatically migrated. All players must reload the updated client and start a new room. Do not import saved legacy game state.

Completed during this update:
- Ludo-only strict TypeScript check, including feature test files.
- Isolated Ludo Vite production build (24.17 kB CSS and 541.07 kB JS before gzip). Vite reports the JS chunk exceeds its 500 kB warning threshold.
- Online UI regression suite: 8 passed (private invitations, pasted links, reconnect, disconnected controls, offline lobby seats).
- Network validation suite: 13 passed, including the corrected finish boundary.
- The earlier overhaul passed 199 tests. Later full-suite runs timed out, so that earlier total does not validate the latest tree as a whole.

Still required before release:
- Complete full-web typecheck/build and Ludo lint in a reliable execution environment; attempts here timed out without a completed result.
- Complete the latest full Ludo test run; repeated runs timed out, including a forks-based focused diagnostic run. The cause is not established.
- Browser checks at phone/tablet/desktop sizes; keyboard/screen-reader controls, focus restoration, reduced motion, dice appearance, and gesture-triggered audio.
- Two-device private joining, disconnect/reconnect before/after the 90-second grace, host departure, and rematches across different networks.
- Confirm HTTPS hosting, SPA rewrites for `/ludo/room/:code`, signalling service availability, and TURN coverage. PeerJS signalling involves a third-party service; do not publish invite URLs or resume tokens in logs/analytics.
- Keep friend-room limitations visible. Competitive play needs a trusted server, persistent state, and recovery policy; those are not included here.
