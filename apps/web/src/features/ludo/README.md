# Ludo Arena (isolated feature)

This folder is a complete, unregistered React Ludo feature. It intentionally does **not** change the dashboard, routes, auth, database, or server. That keeps the current website safe until you approve the merge.

## Included now

- Responsive SVG board that stays sharp from phone to desktop.
- Animated tokens, rollable dice, touch-friendly controls, reduced-motion support, turn timers, activity feed, player presence/ping UI, and a pass-device privacy screen.
- Fully playable single-player match with tactical bots, and two-to-four-player pass-and-play.
- Classic rules engine with safe squares, captures, blockades, exact finish, extra turns, three-six cancellation, rankings, and deterministic test coverage.
- Online-room client contract: five-digit room codes, secure private invite links, guest identity protocol, snapshots, intent validation, heartbeats, reconnection, and ping reporting.
- A ready-to-apply Postgres/server integration package in [`server-contract`](./server-contract/README.md).

## Later merge (only after approval)

1. Add a public `LudoPage` that renders `LudoArena`.
2. Add a public `/ludo/room/:code` route before `ProtectedRoute` so shared invite links do not force website login.
3. Add the Ludo quick-action button to `apps/web/src/pages/dashboard/DashboardPage.tsx`.
4. Apply [`server-contract/ludo.sql`](./server-contract/ludo.sql), then add a server-authoritative `/ws/ludo` endpoint using the same pure rules engine.
5. Configure `VITE_LUDO_WS_URL=wss://your-server/ws/ludo` and switch the room screen to `LudoSocketRoom`.

## Local isolated preview

The small preview entry point is deliberately inside this feature:

```powershell
npx vite apps/web/src/features/ludo/preview --config apps/web/vite.config.ts
```

It only serves the feature preview; it does not register a page in the existing app.

## Important online note

The existing server and database can absolutely support a small friends-only Ludo room system. The client transport and database/server contract are included here, but live cross-device matchmaking must wait for the approved server merge. It must use a server-authoritative socket and persisted game state; browser code must never be trusted to choose dice rolls or mutate a room state.
