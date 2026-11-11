# Persistência de salas (Redis)

## Decisão

As salas podem ficar no **Redis**, para que uma partida **sobreviva a reinícios** do
servidor (deploy, crash, `npm run dev` reiniciando). O Redis é **opcional**: sem `REDIS_URL` o app
funciona exatamente como antes, em memória.

Escopo escolhido: **uma instância Node** com estado persistido. Rodar várias instâncias ao mesmo tempo
**não** é suportado ainda (ver "Limitações" e `06-future-work.md`).

## O que é (e o que não é) persistido

| Dado | Onde | Observação |
| --- | --- | --- |
| Estado da sala (`Room`: jogadores, votos, rodada, respostas, placar) | Redis `beatrush:room:<CÓDIGO>` | JSON; TTL renovado a cada gravação (padrão 6 h) |
| Fila de músicas das próximas rodadas | no mesmo snapshot | já sorteadas, para a partida continuar igual; **sem links de áudio** (expiram) |
| **Prazo armado** (`deadline`: `endVote`/`nextRound`/`endRound`/`afterReveal` + horário) | no mesmo snapshot | permite rearmar o timer pelo tempo que faltava |
| Conexões WebSocket | memória do processo | não dá para persistir |
| Timers | memória do processo | são **rearmados** a partir do `deadline` |

## Como a restauração funciona

```
commit(): salva snapshot (fila serial por sala) + broadcast
            │
   servidor cai ──▶ novo processo: restore()
                     ├─ carrega snapshots (SCAN + MGET)
                     ├─ marca TODOS os jogadores como offline (ninguém está conectado ainda)
                     └─ rearma o timer: max(0, deadline.at − agora)
   TV (sessionStorage) e celulares (localStorage) reconectam sozinhos com o mesmo código/playerId
```

- Os clientes já tinham reconexão com backoff (0,5 s → 5 s); nada mudou neles.
- Um prazo vencido durante a queda dispara na hora (ex.: a rodada acabou enquanto o servidor estava fora → revelação imediata).
- Se o servidor caiu **enquanto as músicas carregavam** (votação encerrada, sem prazo salvo), a restauração refaz o sorteio e inicia a partida.
- `SNAPSHOT_VERSION` protege contra mudança de formato: snapshots de outra versão (ou inválidos) são **ignorados com aviso**, nunca derrubam o boot.
- Gravações de uma sala saem **em ordem** (cadeia de promises), então o último estado é o que fica salvo.
- No desligamento (`SIGINT`/`SIGTERM`) o servidor espera as gravações pendentes antes de sair.

## Salas abandonadas

Antes, uma sala nunca saía da memória. Agora, sem nenhuma conexão (TV e celulares) por `ROOM_IDLE_MS`
(30 min), a sala é removida da memória **e** do Redis. Reconectar a tempo cancela a remoção.
O TTL do Redis (`ROOM_TTL_SECONDS`) é a segunda rede de segurança.

## Falhas do Redis

| Situação | Comportamento |
| --- | --- |
| `REDIS_URL` definido e Redis fora do ar **na subida** | o servidor **não sobe**, com mensagem clara (melhor que rodar achando que persiste) |
| Redis cai **com o jogo no ar** | o jogo continua em memória; avisa no log (máx. 1×/30 s). Gravações voltam quando ele retornar |

## Links de preview e por que não há cache de faixas

Os links de `preview` do Deezer são **assinados e expiram em ~14 min**. Por isso:

- **Não existe cache de faixas** (guardaria links que vencem; o ganho era mínimo).
- A fila persistida **não guarda o link de áudio**, só id, título, artista e capa.
- O link atual é buscado pelo id **no início de cada rodada** (`getTrack`; ver `04-music-providers.md`).
  Assim uma sala restaurada muito tempo depois toca normalmente. Se a busca falhar, a rodada usa o
  link anterior se ainda o tiver em memória; após um reinício não há link anterior e a rodada toca sem áudio.
- A faixa só sai da fila **depois** de renovada, e o prazo `nextRound` continua registrado durante a
  renovação: se o servidor cair nesse intervalo, a restauração tenta iniciar a mesma rodada de novo.

## Como rodar

```bash
npm run redis:up                                   # Redis local via Docker (docker-compose.yml)
echo REDIS_URL=redis://localhost:6379 >> .env.local
npm run dev                                        # log: "persistência: redis" e "N sala(s) restaurada(s)"
npm run redis:down
```

Variáveis: `REDIS_URL`, `REDIS_PREFIX` (padrão `beatrush:`), `ROOM_TTL_SECONDS`, `ROOM_IDLE_MS`.
Veja `.env.example`. O `server.ts` carrega `.env`/`.env.local` antes de ler `REDIS_URL`.

## Testes

- `persistence.test.ts`: contrato de `RoomStore` (memória e Redis com cliente falso) e fábrica.
- `room-manager-preview.test.ts`: renovação do link por rodada (sucesso, erro, `null`, demora, `startedAt`), fila sem links no store e queda no meio da renovação.
- `room-manager-restart.test.ts`: reinício em **cada fase** (lobby, votação, rodada, revelação, fim,
  carregando músicas), salas abandonadas e falhas do store. Foi validado por mutação (quebrar o rearme
  de timers, a marcação de offline ou a gravação faz testes falharem).
- `restart-integration.test.ts` e o bloco "Redis real": **Redis + WebSocket reais**, só com
  `REDIS_URL` (`npm run test:redis`). Sem `REDIS_URL` ficam pulados e `npm test` continua sem dependências.

## Limitações conhecidas

- **Uma instância só.** Duas instâncias no mesmo Redis ambas restaurariam as mesmas salas e disputariam
  os timers. Escalar exigiria pub/sub para espalhar o estado, "dono" da sala (lock com lease) para os
  timers e roteamento das conexões — ver `06-future-work.md`.
- **Lobby:** jogadores que desconectam no lobby liberam a vaga (regra existente). Após um reinício eles
  voltam como *offline* e reocupam a vaga ao reconectar; quem não voltar fica como "Offline" até a sala expirar.
- Partida em andamento com todos desconectados continua avançando por tempo (rodadas sem resposta),
  até todos voltarem ou a sala ser limpa.
