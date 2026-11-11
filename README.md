# BeatRush Party 🎵

Quiz musical multiplayer: a TV mostra e toca; os celulares respondem. Quem acerta mais rápido ganha mais pontos.

- **Next.js + Tailwind** · **WebSocket (`ws`)** · **Zustand** · **Zod**
- Música via `MusicProvider` (Deezer, Mock para testes). O logo do Deezer, exigido pela API, aparece nas telas (ver [docs/04-music-providers.md](docs/04-music-providers.md))
- **Idiomas:** pt-BR, inglês e espanhol (por aparelho; ver [docs/07-i18n.md](docs/07-i18n.md))

```bash
npm install
npm run dev            # http://localhost:3000
```

1. Abra `http://localhost:3000` na TV/notebook e clique em **Criar Nova Sala**.
2. No celular, escaneie o QR Code (ou abra `/play` e digite o código).
3. O primeiro jogador inicia a votação de gêneros e a partida começa.

**Redis (opcional):** `npm run redis:up` e `REDIS_URL=redis://localhost:6379` no `.env.local` para as partidas sobreviverem a reinícios (ver [docs/08-persistence-redis.md](docs/08-persistence-redis.md)).

Qualidade: `npm run verify` (lint + tipos + unitários) · `npm run test:e2e` (Playwright).

Documentação em [docs/](docs/README.md).
