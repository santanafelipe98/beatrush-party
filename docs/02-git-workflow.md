# Fluxo Git

- `main` está sempre verde.
- Uma branch por feature: `feat/<nome>` (ou `chore/`, `docs/`).
- Antes de integrar: `npm run verify` (lint + typecheck + testes unitários) e, quando a feature toca UI/WebSocket, `npm run test:e2e`.
- Integração com `git merge --no-ff` na `main`; em seguida a branch é excluída (`git branch -d`).
- Commits em formato convencional (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).

## Roadmap de features

1. `chore/scaffold` — Next.js, Tailwind, Vitest, Playwright
2. `feat/design-system` — tokens e componentes base + menu inicial
3. `feat/game-core` — domínio puro (máquina de estados, pontuação)
4. `feat/music-provider` — interface + Mock + Deezer (+ esqueleto Spotify)
5. `feat/realtime-server` — servidor customizado com WebSocket e salas
6. `feat/host-ui` — telas H2–H5 da TV
7. `feat/controller-ui` — telas P1–P4 do celular
8. `feat/e2e` — fluxo completo automatizado
