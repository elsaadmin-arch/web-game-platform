# Code Index

Quick-scan reference for locating files. One line per entry.
**Keep updated** after every add/delete/rename/significant change.

---

## packages/shared

| File | Description | Keywords |
|---|---|---|
| `packages/shared/src/index.ts` | Shared TS types: GamePlugin interface, Room, Player, ClientMessage, ServerMessage, GameState | types, plugin, room, player, websocket, messages |
| `packages/shared/src/__tests__/room-code.test.ts` | Unit tests for room code generation/validation | tests, room code, alphanumeric |

---

## workers/room-worker

| File | Description | Keywords |
|---|---|---|
| `workers/room-worker/src/index.ts` | Cloudflare Durable Objects room worker — handles HTTP fetch, WebSocket connections, join/rejoin/start_game/action/rematch routing, broadcasts room_update | durable object, websocket, room, broadcast, CF worker |
| `workers/room-worker/src/__tests__/room.test.ts` | Worker integration tests for room creation and player join flow | tests, room, worker |
| `workers/room-worker/wrangler.toml` | Wrangler config — DO binding ROOMS → RoomDurableObject, migration tag v1 | wrangler, config, durable object |

---

## games/exploding-kittens

| File | Description | Keywords |
|---|---|---|
| `games/exploding-kittens/src/index.ts` | ExplodingKittensPlugin entry — assembles plugin from types/utils/actions, exports GamePlugin | plugin, entry, exports |
| `games/exploding-kittens/src/types.ts` | EK-specific types: CardType, Card, EKGameState, EKAction | types, card, state, action |
| `games/exploding-kittens/src/utils.ts` | Pure helpers: shuffle, buildDeck, getAlivePlayers, nextPlayerIndex, addLog, endTurn | utils, shuffle, deck, turn, alive |
| `games/exploding-kittens/src/actions.ts` | Action reducers: applyDrawCard, applyInsertKitten, applyPlayCard, applyNope, applyGiveCard | actions, draw, play, nope, favor, bomb |
| `games/exploding-kittens/src/__tests__/game.test.ts` | 24 unit tests for game logic — deal, draw, bomb, defuse, skip, attack, nope, favor, see_the_future | tests, game logic |

---

## apps/platform

| File | Description | Keywords |
|---|---|---|
| `apps/platform/src/main.tsx` | React entry point — mounts App into #root | entry, react |
| `apps/platform/src/App.tsx` | Top-level routing — landing/name-prompt/waiting-room/in-game screens | routing, screens, lobby |
| `apps/platform/src/useRoom.ts` | Custom hook — WebSocket lifecycle, room state, createRoom/joinRoom/leave/send | hook, websocket, room state, session |
| `apps/platform/src/session.ts` | Session persistence helpers — loadSession/saveSession/clearSession via localStorage | session, localstorage, persistence |
| `apps/platform/src/types.ts` | Platform-level types: EKGameState, Player, Screen, GameScreenProps (re-exported for UI) | types, platform, screen |
| `apps/platform/src/GameScreen.tsx` | In-game UI — hand display, deck, discard, turn indicator, log, nope button, overlays (finished/inserting_kitten/favor/see_the_future) | game screen, hand, cards, ui |
| `apps/platform/src/CardTile.tsx` | Card tile component + CARD_EMOJI/CARD_LABEL maps | card, tile, emoji, component |
| `apps/platform/vite.config.ts` | Vite config — proxies /rooms → localhost:8787 | vite, proxy, config |
| `apps/platform/index.html` | HTML entry point | html, entry |

---

## Root

| File | Description | Keywords |
|---|---|---|
| `DEVELOPMENT.md` | Dev setup, commands, architecture overview, common issues, git workflow | setup, dev, commands |
| `vitest.config.ts` | Unit test config — excludes workers/ and e2e/ | vitest, unit tests, config |
| `vitest.workers.config.ts` | Worker integration test config — uses @cloudflare/vitest-pool-workers | vitest, worker tests, cloudflare |
| `playwright.config.ts` | E2E test config — Chromium desktop + mobile WebKit, baseURL localhost:3000 | playwright, e2e, config |
| `e2e/lobby.spec.ts` | 16 Playwright E2E tests — create room, join room, player list, start game | e2e, tests, lobby |
| `package.json` | Root npm workspace — workspaces: apps/*, games/*, workers/*, packages/* | workspace, npm |

---

## docs

| File | Description | Keywords |
|---|---|---|
| `docs/CODE_INDEX.md` | This file — quick-scan reference for all source files | index, navigation |
