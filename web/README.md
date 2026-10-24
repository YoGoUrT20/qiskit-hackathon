# Ghost Walk web

The playable game and docs site. React + Vite + TypeScript.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/
```

- `#/` start screen, `#/play` the hunt, `#/tutorial` the guided walk-through, `#/docs` how it works and the real-chip results.
- `src/engine/walk.ts` is the same quantum walk as `../quantum_walk.py` (Hadamard coin, start coin (|0> + i|1>)/sqrt(2)), simulated in the browser so every click answers instantly.
- `src/data/chip.json` holds the real IBM runs. After a new hardware job (`python ../run_on_ibm.py fetch`), refresh it with `npm run sync-data`.
