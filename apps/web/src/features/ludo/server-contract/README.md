# Ludo server contract

This is a future deployment contract, not an implemented or deployed authoritative server. The current UI uses a client-hosted PeerJS room; a modified host can control dice, state, and admission.

This is the merge packet for the isolated Ludo UI. It is designed for the existing Express + `ws` + Prisma/Postgres stack and deliberately avoids reusing Remote Call Bridge sockets.

## Why a separate endpoint

Add `/ws/ludo`, not a new independent upgrade listener and not `/ws/phone` or `/ws/tablet`. The existing bridge socket has device-pairing authentication and process-local assumptions that are unrelated to a board game.

## Required database records

Apply [`ludo.sql`](./ludo.sql) or translate it into the Prisma schema:

- `ludo_guest_sessions` — server-issued anonymous identity, expiry and revoked token hash. Ask only for a visible name.
- `ludo_rooms` — five-digit display code, secret invite hash, authoritative game snapshot, state version and current turn deadline.
- `ludo_room_players` — one seat/color per player, optional real user id, guest session, availability, ping and disconnect-grace deadline.
- `ludo_game_events` — append-only replay/event record.

The room code is deliberately convenient, not secret. For the future private-room server deployment, the invite URL must have a separate 24-byte secret, stored hashed in the database. See the current PeerJS admission model below; the two-argument client API does not enforce an invite.

## WebSocket flow

1. `AUTH` must arrive within 10 seconds with room code, invite secret, and a server-issued Ludo guest token (or signed-in identity).
2. Server returns `AUTHENTICATED` and the current `SNAPSHOT`.
3. Client sends `READY`, `PING`, `REJOIN`, or `INTENT` with `{ type: "ROLL" }`, `{ type: "MOVE", tokenIndex }`, or `{ type: "FORFEIT" }` in [`../online/protocol.ts`](../online/protocol.ts). Engine-only `value`, `now`, and timeout `reason` are not network intent fields.
4. Server uses cryptographic random dice, checks `expectedRevision`, runs the shared rules engine, writes event + snapshot in a single transaction, then broadcasts the new snapshot.
5. Ping every 20 seconds; display RTT from `PONG`; set player to reconnecting after heartbeat loss. Keep a seat for 90 seconds before applying the room's timeout/forfeit policy.

## Security baseline

- Do not use the current generic website guest token as the multiplayer identity. It is client-synthesized and not durable enough for a trusted room seat.
- Validate the WebSocket `Origin`, rate-limit create/join operations, limit room to four players, and rate-limit intents.
- Never accept dice values, timers, player lists, or board state directly from a client.
- Persist after every validated action. Render instances can restart, and reconnecting sockets may land on a fresh process.

## Merge target outline

```text
apps/server/src/ludo/
  room-service.ts       # database transaction + state snapshots
  websocket.ts          # /ws/ludo handler and heartbeat
  guest-session.ts      # creates/refreshes signed Ludo guest identity
  router.ts             # create/join/lookup tRPC procedures

apps/web/src/pages/ludo/
  LudoPage.tsx          # public room gate + LudoArena
```

For one small private Render instance, the native `ws` server is sufficient. If you later run multiple instances, broadcast through Redis/Supabase Realtime and always reload the persisted snapshot on reconnect.

## Current PeerJS integration and limitations

- `hostRoom(code, name, inviteSecret?)` preserves the two-argument API. Without the third argument, admission is **code-only**, not private. The UI now calls `hostRoom(code, name, inviteSecret)` for generated private rooms using the same 48-character hexadecimal value placed in the share URL.
- `joinRoom(codeOrShareUrl, name, inviteSecret?)` accepts a five-digit code or full HTTP(S) `/ludo/room/12345?invite=...` URL. The UI forwards the route's `invite` query value as the third argument and parses pasted full links before extracting the code. URL origins are not fetched or used to select signalling infrastructure.
- The host sends a private `accepted` packet with a random seat ID and 192-bit resume token. Lobby/snapshot packets expose IDs, never resume tokens. Names and PeerJS IDs are not credentials. A valid resume atomically replaces the previous seat channel, including in full/in-progress rooms; the old channel's callbacks cannot detach its replacement.
- `usePeerLudo().reconnect()` retries the last guest session. The UI exposes a reconnect button for closed guest sessions without calling `leave()` first and locks game actions until playing resumes. Tokens remain only in the mounted hook's memory, not browser storage. Reload/unmount recovery and automatic reconnect are not implemented. Explicit leave/kick revokes the reservation; delivery of leave is best-effort, with grace expiry as fallback.
- Unexpected disconnect reserves the seat for 90 seconds. A lobby reservation blocks match start, then expires and frees the slot. In-progress seats become offline after expiry, retaining board identity; normal host-owned turn timeouts continue. Restart waits for reconnecting reservations and removes expired offline seats.
- Packet shapes, sizes, traversal work, per-channel rates, pending handshakes, send buffers, connection deadlines, and stale callbacks are bounded in the application. PeerJS deserializes before application validation, so these checks do not cap transport-library allocation or replace server-side ingress controls.
- Connection/admission deadlines are 15 seconds; guests heartbeat every 10 seconds and detect silence after 35 seconds (at the next heartbeat tick). Closing/replacing rooms clears clocks and pending bot actions. Guest actions carry match ID and expected revision; every host-side human action checks the active seat, phase, and deadline.
- The unused WebSocket adapter validates server packets, gates actions on authentication, bounds retry/auth/state deadlines, correlates pongs, and rejects stale snapshots. `onAuthenticated?(player)` exposes server-assigned identity. Server implementations must still bind authenticated connections to seats, validate actions transactionally, and provide durable revisions and new match IDs on restart.
- No host migration, durable room recovery, trusted dice, deployed guest-session API, or deployed `/ws/ludo` authority is provided here. Client-side checks do not prevent a modified host from cheating. Signalling service availability, NAT/TURN reachability, secure browser randomness, and real multi-browser testing remain deployment requirements.
