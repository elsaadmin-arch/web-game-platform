# Web Game Platform

Zero-cost multiplayer web game platform built on Cloudflare.

## Structure

```
apps/platform         — player-facing shell, lobby, room join UI
apps/admin            — CMS admin UI (game/platform config)
workers/room-worker   — Durable Objects: room state + WebSocket broadcast
workers/config-worker — KV read/write API for CMS
games/exploding-kittens — first game
packages/shared       — shared types, GamePlugin interface
```

## Dev

```bash
npm install
npm run dev           # starts all apps + workers locally
```

## Stack
- Cloudflare Pages (frontend hosting)
- Cloudflare Workers (serverless API)
- Cloudflare Durable Objects (stateful rooms + WebSocket)
- Cloudflare KV (config storage)
- React + Vite (frontend)
- TypeScript throughout
