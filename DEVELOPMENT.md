# Developer Guide

## Prerequisites

- Node.js 22+
- npm 10+
- Wrangler (already in devDeps, no global install needed)

---

## Starting the dev environment

You need two processes running simultaneously:

**Terminal 1 — Room Worker (Cloudflare Durable Objects, port 8787)**
```bash
cd workers/room-worker
npx wrangler dev --local
```

**Terminal 2 — Platform UI (Vite dev server, port 3000)**
```bash
cd apps/platform
npx vite --host 0.0.0.0 --port 3000
```

> `--host 0.0.0.0` exposes the app on your LAN so you can test on mobile.
> Mobile URL: `http://<your-mac-ip>:3000` (e.g. `http://192.168.128.145:3000`)

Vite proxies `/rooms/*` → worker on 8787 automatically (see `vite.config.ts`).

### Check your LAN IP
```bash
ipconfig getifaddr en0
```

---

## Running tests

```bash
# Unit tests (game logic, shared utils) — fast, ~150ms
npm test

# Unit tests in watch mode (re-runs on save)
npm run test:watch

# Unit tests with browser UI
npm run test:ui

# E2E tests (Playwright — requires dev servers running)
npm run test:e2e

# E2E with Playwright UI (step-through debugger)
npm run test:e2e:ui

# Run everything
npm run test:all
```

### Before pushing — always run:
```bash
npm test && npm run test:e2e
```

---

## Project structure

```
web-game-platform/
  apps/
    platform/         — Player-facing lobby + game shell (React + Vite + Tailwind)
    admin/            — CMS admin UI (game/platform config) — WIP
  workers/
    room-worker/      — Cloudflare Durable Objects: room state + WebSocket broadcast
    config-worker/    — KV read/write API for CMS — WIP
  games/
    exploding-kittens/ — First game (pure TS game logic, no framework)
    <future-games>/
  packages/
    shared/           — Shared types: GamePlugin interface, Room, Player, WS messages
  e2e/                — Playwright end-to-end tests
```

---

## Adding a new game

1. Create `games/<game-name>/src/index.ts`
2. Implement the `GamePlugin` interface from `@wgp/shared`
3. Add unit tests at `games/<game-name>/src/__tests__/game.test.ts`
4. Register the game in the platform router (TBD once routing is built)

**GamePlugin interface:**
```ts
interface GamePlugin {
  id: string
  name: string
  minPlayers: number
  maxPlayers: number
  getInitialState(playerIds: string[], config: GameConfig): GameState
  applyAction(state: GameState, action: PlayerAction, config: GameConfig): GameState
  isGameOver(state: GameState): boolean
  getWinner(state: GameState): string | null
}
```

---

## Architecture decisions

See `vault/projects/web-game-platform/discussions/` for full context on each decision.

| Topic | Decision |
|---|---|
| Hosting | Cloudflare Pages + Workers + Durable Objects (zero cost) |
| Realtime | Server-authoritative Durable Objects — DO holds game state, validates actions |
| Auth | None — room code only (6-char, no ambiguous chars) |
| Rooms | Per-game player cap (via CMS), rematch-friendly, 30min inactivity expiry |
| Repo | Monorepo, extract games later if assets grow |
| CSS | Tailwind v4 — platform UI only, games define their own styles |
| CMS | Custom admin UI on CF Pages + Workers + KV |

---

## Common issues

**Port 8787 already in use**
```bash
pkill -f "wrangler dev"
```

**Copy button not working on mobile (LAN HTTP)**
This is expected — clipboard API requires HTTPS. The app falls back to `execCommand('copy')` which works on most mobile browsers over HTTP. On production (HTTPS) it uses the native clipboard API.

**Players not showing up in waiting room**
Make sure the worker is running (`wrangler dev --local` on port 8787) before opening the UI. The UI proxies WebSocket connections through Vite → worker.

---

## Git workflow

```bash
# Before starting work
git pull origin main

# After a feature or fix
npm test && npm run test:e2e   # must pass
git add -A
git commit -m "feat/fix/chore: description"
git push origin main
```

Vault is auto-backed up to GitHub daily at 3:00 AM HKT.
Project notes: `vault/projects/web-game-platform/`
