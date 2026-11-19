# Penalty Shootout

A browser football penalty game — Solo or Two-Player against a computer Keeper.

- Game design: [Penalty-Shootout-Game.md](./Penalty-Shootout-Game.md)
- Vocabulary: [GLOSSARY.md](./GLOSSARY.md)

## Develop

Requires Node.js (LTS).

```sh
npm install
npm run dev      # play locally at the printed URL
npm test         # rules unit tests (Vitest)
npm run build    # type-check + production build into dist/
```

## Layout

- `src/rules/` — pure game rules (Kick resolution, Power Meter, Shootout progression). No DOM; randomness is injected so tests are deterministic.
- `src/ui/` — Pitch rendering, sound, browser storage.
- `src/main.ts` — screens (Menu, Pitch, Result) and game flow.

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`, which tests, builds and publishes to GitHub Pages. In the repository settings, set **Pages → Source** to **GitHub Actions**.
