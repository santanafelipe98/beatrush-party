# Protocolo em tempo real (WebSocket)

## Por que WebSocket + servidor customizado

O estado da partida precisa ser empurrado do servidor para TV e celulares com baixa latência
(o tempo de resposta vale pontos). Next.js (App Router) não hospeda WebSocket em route handlers,
então usamos um **servidor Node customizado** (`server.ts`): um `http.Server` que delega HTTP ao Next
e atende `Upgrade` em `/ws` com a lib `ws`. Outros upgrades (HMR do Next em dev) seguem para o Next.

Consequência: o deploy precisa de um processo Node de longa duração (não serverless/edge). O estado
das salas fica **em memória** (uma instância). Para escalar horizontalmente seria preciso
Redis pub/sub + sticky sessions; o `RoomManager` isola essa dependência.

## Camadas

```
browser ──ws──▶ ws-server.ts (parse zod) ──▶ RoomManager ──▶ domínio puro (features/game)
                                                  │
                                                  └──▶ MusicProvider (features/music)
```

- `src/server/ws-server.ts`: transporte; valida cada mensagem com Zod; heartbeat ping/pong.
- `src/server/room-manager.ts`: orquestra salas, timers (votação, rodada, revelação), sorteio de
  músicas, reconexão. Depende de `Connection`/`Timers`/relógio injetáveis ⇒ testável sem rede.
- `src/features/realtime/protocol.ts`: contrato compartilhado cliente/servidor (schemas Zod + tipos).
- `src/features/realtime/projection.ts`: transforma o estado interno em `RoomView` por espectador.

## Mensagens

Cliente → servidor (`clientMessageSchema`):

| type | Quem | Efeito |
| --- | --- | --- |
| `host:create` | TV | cria sala, responde `host:created {code}` |
| `host:attach {code}` | TV | reanexa após recarregar a página |
| `player:join {code, playerId, name, avatar}` | celular | entra/reconecta (`playerId` fica no `localStorage`) |
| `player:start` | host-jogador | abre a votação de gêneros |
| `player:vote {genres}` | celular | até 3 gêneros |
| `player:answer {choice 0..3}` | celular | responde a rodada |
| `player:replay` | celular | vota por jogar novamente |

Servidor → cliente: `host:created`, `error {code}`, e `state {view}` — **o estado completo**
(snapshot) a cada mudança. Snapshots em vez de eventos incrementais simplificam reconexão e
eliminam divergência; o payload é minúsculo (≤ 8 jogadores).

## Segurança de informação (`projectRoom`)

- `correctIndex`, título e artista da faixa só aparecem na fase `reveal`.
- `previewUrl` (áudio) só vai para a TV, e só durante `playing`.
- Respostas de outros jogadores não são enviadas durante a rodada (apenas `answeredIds`).
- Tempo: o servidor é a autoridade (`startedAt`, `serverNow`); o cliente apenas exibe a contagem.

## Reconexão

Fechar o socket de um jogador no lobby libera a vaga; durante a partida marca `connected=false`.
Reentrar com o mesmo `playerId` restaura a sessão. Um jogador offline não bloqueia o fim antecipado
de rodada/votação (apenas os conectados são considerados).
