# Ludo server contract

This is the merge packet for the isolated Ludo UI. It is designed for the existing Express + `ws` + Prisma/Postgres stack and deliberately avoids reusing Remote Call Bridge sockets.

## Why a separate endpoint

Add `/ws/ludo`, not a new independent upgrade listener and not `/ws/phone` or `/ws/tablet`. The existing bridge socket has device-pairing authentication and process-local assumptions that are unrelated to a board game.

## Required database records

Apply [`ludo.sql`](./ludo.sql) or translate it into the Prisma schema:

- `ludo_guest_sessions` — server-issued anonymous identity, expiry and revoked token hash. Ask only for a visible name.
- `ludo_rooms` — five-digit display code, secret invite hash, authoritative game snapshot, state version and current turn deadline.
- `ludo_room_players` — one seat/color per player, optional real user id, guest session, availability, ping and disconnect-grace deadline.
- `ludo_game_events` — append-only replay/event record.

The room code is deliberately convenient, not secret. The invite URL must have a separate 24-byte secret, stored hashed in the database.

## WebSocket flow

1. `AUTH` must arrive within 10 seconds with room code, invite secret, and a server-issued Ludo guest token (or signed-in identity).
2. Server returns `AUTHENTICATED` and the current `SNAPSHOT`.
3. Client sends `READY`, `ROLL`, `MOVE`, `PING`, or `REJOIN` through intent messages in [`../online/protocol.ts`](../online/protocol.ts).
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
