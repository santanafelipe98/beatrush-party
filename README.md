# BeatRush Party 🎵

Quiz musical multiplayer: a TV mostra e toca; os celulares respondem. Quem acerta mais rápido ganha mais pontos.

- **Next.js + Tailwind** · **WebSocket (`ws`)** · **Zustand** · **Zod**
- Aviso legal "Sobre" no app (sem direitos das músicas, apenas consome o Deezer, uso não comercial)
- Música via `MusicProvider` (Deezer, Mock para testes). O logo do Deezer, exigido pela API, aparece nas telas (ver [docs/04-music-providers.md](docs/04-music-providers.md))
- **Idiomas:** pt-BR, inglês e espanhol (por aparelho; ver [docs/07-i18n.md](docs/07-i18n.md))

```bash
npm install
npm run dev            # http://localhost:3000
```

> **Logo do Deezer:** o arquivo do logo **não** vem neste repositório (os termos do Brand Hub do Deezer não permitem redistribuí-lo; ver [NOTICE](NOTICE)). Sem ele o app mostra o texto "Powered by Deezer". Para publicar uma instância, obtenha o logo com o Deezer e coloque em `public/brand/deezer/Signatures-PoweredBy-DE.svg` (a pasta é ignorada pelo git).

1. Abra `http://localhost:3000` na TV/notebook e clique em **Criar Nova Sala**.
2. No celular, escaneie o QR Code (ou abra `/play` e digite o código).
3. O primeiro jogador inicia a votação de gêneros e a partida começa.

**Redis (opcional):** `npm run redis:up` e `REDIS_URL=redis://localhost:6379` no `.env.local` para as partidas sobreviverem a reinícios (ver [docs/08-persistence-redis.md](docs/08-persistence-redis.md)).

Qualidade: `npm run verify` (lint + tipos + unitários) · `npm run test:e2e` (Playwright).

Documentação em [docs/](docs/README.md).

## Licença

O código é distribuído sob a [Licença MIT](LICENSE). Isso cobre **apenas** o código e a documentação deste repositório.

- O **logo do Deezer** (que nem está neste repositório), as **músicas, capas e dados** vêm do Deezer e **não** são cobertos pela MIT (ver [NOTICE](NOTICE)).
- O uso da **API do Deezer** é restrito a **fins não comerciais** pelos [termos deles](https://developers.deezer.com/termsofuse). Essa restrição vale para quem executa o app com a API, não para o código em si. Quem publicar uma instância deve cumpri-la.
- O BeatRush Party não é afiliado, patrocinado nem endossado pelo Deezer.
