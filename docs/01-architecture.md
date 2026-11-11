# Arquitetura

BeatRush Party é um quiz musical multiplayer estilo "Jackbox": a **TV/notebook (Host)** mostra o
jogo e toca as músicas; cada **celular (Controller)** responde. Origem do design: protótipo
"BeatRush Party" (Claude Design) com telas H1–H5 (Host) e P1–P4 (Controller).

## Stack e por quê

| Escolha | Motivo |
| --- | --- |
| Next.js (App Router) + TypeScript | Roteamento (`/`, `/host`, `/play`), SSR do shell, build único. |
| Tailwind CSS v4 | Tokens do design em `@theme` (`globals.css`); componentes sem CSS solto. |
| Servidor Node customizado + `ws` | WebSocket no mesmo processo/porta do Next (ver `03-realtime-protocol.md`). |
| Zod | Contrato de mensagens validado nas duas pontas. |
| Zustand | Estado do cliente (snapshot da sala, status da conexão, erro). Mínimo e fora da árvore React. |
| Vitest + Testing Library | Unitários de domínio, servidor, store e componentes. |
| Playwright | E2E com TV + 2 celulares reais em contextos separados. |

## Estrutura de pastas

```
server.ts                      bootstrap: Next + ws + RoomManager
src/
  app/                         rotas finas (só compõem features)
    page.tsx                   H1 menu
    host/page.tsx              TV
    play/page.tsx              celular
  components/ui/               design system (Button, Avatar, Equalizer, ShapeIcon…)
  features/
    game/                      DOMÍNIO PURO: tipos, sala, pontuação (sem I/O)
    music/                     porta MusicProvider + adaptadores + sorteio de rodadas
    realtime/
      protocol.ts              contrato cliente↔servidor (Zod)
      projection.ts            estado interno → visão pública por espectador
      client/                  GameSocket (reconexão), store Zustand, hooks
    host/components/           telas da TV
    controller/components/     telas do celular
  server/                      RoomManager (orquestração/timers) + transporte ws
    persistence/               RoomStore: memória e Redis (ioredis)
  lib/                         utilidades (cn, uuid) e i18n/ (pt-BR, en, es — ver 07-i18n.md)
e2e/                           testes Playwright
docs/                          decisões e arquitetura
```

## Regras de dependência

```
app ─▶ features/{host,controller} ─▶ features/realtime/client ─▶ protocol
                                  └▶ components/ui
server ─▶ features/{game,music,realtime(protocol,projection)}
features/game  ← não importa nada do projeto (núcleo)
features/music ─▶ game (apenas tipos)
```

O domínio não conhece React, WebSocket nem provedores de música. Isso permite trocar Deezer por
outro provedor, ou o transporte por outro, sem tocar nas regras.

## Decisões

1. **Servidor autoritativo.** O cliente nunca decide pontuação nem tempo; só envia intenções
   (`player:answer`). O servidor carimba o tempo e valida a janela.
2. **Snapshots, não deltas.** Cada mudança reenvia a `RoomView` completa, projetada por papel.
3. **Estado em memória, persistido no Redis (opcional).** Cada sala vive em memória (rápido) e é gravada a
   cada mudança no Redis, junto com o prazo do timer armado; ao reiniciar, `RoomManager.restore()` recarrega
   e rearma tudo. Uma instância por vez. Ver `08-persistence-redis.md`.
4. **Host é um jogador.** A TV não possui controles; o primeiro jogador que entra inicia a partida
   (o design da TV mostrava um botão, mas TV/notebook raramente têm entrada prática).
5. **Fallback de catálogo.** Se o provedor falha, `RoomManager` usa o `mock` (sem áudio) em vez de
   derrubar a partida.
6. **Acessibilidade.** Formas das respostas têm `aria-label`; cores nunca são o único sinal
   (forma + cor); `prefers-reduced-motion` desliga animações.

## Divergências em relação ao design

- Telas H4 "tocando" e "opções" foram unificadas numa só (opções visíveis enquanto a música toca).
- QR Code do protótipo era ilustrativo; aqui é real (`qrcode`) e aponta para `/play?code=XXXX`.
- Botões "Jogar Novamente / Voltar ao Lobby" da TV viraram votação nos celulares (maioria simples).

## Como rodar

```bash
npm install
npm run dev          # http://localhost:3000 (MUSIC_PROVIDER=deezer por padrão)
MUSIC_PROVIDER=mock npm run dev   # catálogo offline, sem áudio
npm run verify       # lint + typecheck + unitários
npm run test:e2e     # Playwright (sobe o servidor sozinho na porta 3100)
```

Variáveis: `PORT`, `MUSIC_PROVIDER` (`deezer|mock`), `VOTE_MS`, `ROUND_MS`, `REVEAL_MS`,
`TOTAL_ROUNDS`. Para jogar com celulares reais, use o IP da máquina na rede local.

## Acesso pela rede local em desenvolvimento

Para jogar com celulares reais em `npm run dev`, abra a TV e os celulares usando o IP da máquina
(ex.: `http://192.168.0.10:3000`). O Next bloqueia por padrão os scripts de dev servidos a hosts
que não sejam `localhost`, e a página renderiza mas **não hidrata** (inputs e botões ficam
inertes). Por isso `next.config.ts` define `allowedDevOrigins` com as faixas de IP privado
(`192.168.*.*`, `10.*.*.*`, `172.*.*.*`) e `127.0.0.1`. O e2e `lan-access.spec.ts` cobre essa regressão.
O Playwright usa `NEXT_DIST_DIR=.next-e2e` para não colidir com um `npm run dev` já aberto.

## Animações

Todas as animações do protótipo são **CSS puro** (sem biblioteca): equalizador (`eq`), pulso
(`pulse-beat`), brilho (`glow`), anel de contagem (`conic-gradient`), confete (`confetti-fall`),
pódio subindo (`rise`) e transição entre telas (`fade-up`). São loops simples e declarativos,
que rodam na GPU, não pesam no bundle e respeitam `prefers-reduced-motion`.
Uma biblioteca (ex.: Motion) só faria sentido para coreografia dependente de estado, como animar a
reordenação do ranking entre rodadas.

Atenção: os `@keyframes` ficam **fora** do `@theme` em `globals.css`. No Tailwind v4, keyframes
dentro de `@theme` só são emitidos se uma classe `animate-*` correspondente for usada, e o
equalizador/confete aplicam a animação inline. O e2e `animations.spec.ts` protege contra isso.
