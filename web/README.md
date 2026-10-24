# Ghost Walk web

The playable game and docs site. React + Vite + TypeScript, plus a Convex backend for group play. Live at https://ghost.yogourt.dev.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/
```

- `#/` start screen, `#/play` the hunt, `#/tutorial` the guided walk-through, `#/docs` how it works and the real-chip results.
- `#/host/<code>` the projector screen of a group game, `#/join/<code>` the phone side, `#/join` asks for a code. `/1234` and `/join/1234` redirect to `#/join/1234`, so the short link to type is `ghost.yogourt.dev/1234`.
- `src/engine/walk.ts` is the same quantum walk as `../quantum_walk.py` (Hadamard coin, start coin (|0> + i|1>)/sqrt(2)), simulated in the browser so every click answers instantly.
- `src/game/rules.ts` holds the rules: 16 rooms, 5 flashlights, 7 warm-up steps, vote times. `src/game/hunt.ts` is the turn reducer that both solo and group play run.
- `src/data/chip.json` holds the real IBM runs. After a new hardware job (`python ../run_on_ibm.py fetch`), refresh it with `npm run sync-data`.

## Online group play

**Play online** (next to Docs on the hunt) creates a game and opens the host screen: a QR code, a four-digit code and a short link. Phones join and get a generated name ("Foggy Qubit"; nothing typed reaches the projector). Each turn everyone votes for a room; the host screen shows the live count per room. When the countdown ends, or the host closes the vote, the most-voted room is searched (a tie is drawn at random among the leaders; if nobody voted, a random room). Then the ghost steps, as in solo, and the next vote opens. The host can switch quantum / coin-flip and the vote time (10, 20, 30 s) between ghosts, and counts ghosts caught.

**The server owns the ghost.** The game document in Convex holds the amplitudes; every flashlight (`project`), step and random roll runs in a Convex mutation ([`convex/games.ts`](convex/games.ts)) with the same `walk.ts` and `hunt.ts` as solo play. Phones only send votes and receive chances, never amplitudes, and there is no hidden "real" room to leak: the outcome is drawn when the flashlight shines. Host actions need a host key that only the creating browser holds.

**Codes** ([`convex/codes.ts`](convex/codes.ts)): four digits as a string. 90 % contain "67" at a random position (67xx, x67x, xx67), the rest are any four digits. `games.create` draws a code and checks it against every game active in the last two hours, inside the same mutation, retrying on a clash; two games created at the same moment cannot both pass, because the second transaction conflicts and reruns. Games idle for two hours expire (an open host screen pings every five minutes), and a cron deletes them.

**Scale.** Each vote is its own document, so 100 phones voting at once never write the same row; phones subscribe only to the game and their own vote. `npm run test:crowd` runs 100 simulated phones against the deployment: all joins and votes landed, median 0.55 s, max 0.9 s.

### Scripts

```bash
npm run simulate        # win rates: greedy and random play, quantum and coin-flip, old and new rules
npm run test:codes      # ~90% of codes contain 67; codes of active games are never reused
npm run test:crowd      # 100 phones join and vote at once against VITE_CONVEX_URL (creates a real game)
npm run deploy          # Convex functions + static site to the server (scripts/deploy.mjs)
```

### Running Convex

The app reads `VITE_CONVEX_URL`; without it the site is solo-only and the Play online button is hidden.

**Locally**, with Convex's own local backend (no account, no Docker; `.env.local` must not set the `CONVEX_SELF_HOSTED_*` variables):

```bash
npx convex dev          # first run: choose "Start without an account (run Convex locally)"
npm run dev             # second terminal
```

`npx convex dev` writes the local URL to `.env.local` as `VITE_CONVEX_URL`, pushes `convex/` on every save and regenerates `convex/_generated/`.

**Self-hosted** (how https://ghost.yogourt.dev runs). `web/.env.local`, never committed:

```bash
CONVEX_SELF_HOSTED_URL=https://ghost-convex.yogourt.dev
CONVEX_SELF_HOSTED_ADMIN_KEY=...      # docker compose exec backend ./generate_admin_key.sh, on the server
VITE_CONVEX_URL=https://ghost-convex.yogourt.dev
DEPLOY_HOST=user@your-server          # ssh target for the static site
DEPLOY_PUTTY_SESSION=my-server        # optional: plink/pscp with a saved PuTTY session instead of ssh/scp
```

With those set, `npx convex dev` pushes to the self-hosted backend and `npm run deploy` deploys everything. Any other self-hosted backend works the same way: run Convex's [self-hosted docker compose](https://github.com/get-convex/convex-backend/tree/main/self-hosted), put it behind HTTPS, and point the three variables at it. The client is pinned to `convex@1.37.0` to match the backend image on the server; upgrade both together.

```
convex/
  schema.ts      games (code, host key, the hunt with the ghost's amplitudes), players, votes
  games.ts       create, options, new ghost, votes, close vote; the turn engine (resolve, advance); expiry
  players.ts     join by code
  codes.ts       game codes (pure, tested by scripts/codes-test.ts)
  names.ts       generated player names
  crons.ts       delete expired games every 15 minutes
src/online/      Convex client, Play online button, saved host/player seats, countdown
src/views/       HostView (projector), JoinView (code entry and phone)
```
