# Regras do jogo e domínio

O domínio vive em `src/features/game` e é **puro**: funções `(Room, entrada) => Room`, sem I/O,
sem relógio (o tempo entra como parâmetro `now`) e sem aleatoriedade escondida (`rng` injetável).
Isso permite testar tudo com Vitest e reutilizar o mesmo código no servidor WebSocket.

## Fases (`Room.phase`)

```
lobby ──startGenreVote──▶ genre-vote ──closeGenreVote + startRound──▶ playing
  ▲                                                                     │ closeRound
  │ resetToLobby                                                        ▼
finished ◀──finishGame (última rodada)── reveal ──startRound (próxima)──┘
```

## Decisões

- **Host é um jogador.** O design mostra "Gabriel (Host)" na lista; o primeiro a entrar vira
  `hostPlayerId` e é o único que inicia a partida. A TV é apenas a tela de exibição.
- **Mínimo 2, máximo 8 jogadores** conectados para iniciar. Entrada só no lobby; um `id` já
  existente reconecta em qualquer fase (tela "Reconectando…").
- **Escolha de gênero:** cada jogador escolhe **1** gênero (`MAX_GENRE_PICKS = 1`). Todos os escolhidos entram
  na partida e **um gênero é sorteado por turno** (`planGenres`): as escolhas (com repetição: escolhido por 2 jogadores
  = o dobro de chance) são embaralhadas e consumidas até acabar, depois embaralhadas de novo, sem repetir o mesmo
  gênero em turnos seguidos quando há outro. Com poucos gêneros distintos, repetem-se só os escolhidos (sem
  completar com outros). Se ninguém escolher, sorteiam-se 3 gêneros. `topGenres` lista os distintos, do mais ao menos escolhido
  (empates pela ordem de `GENRES`). Votos antigos salvos com vários gêneros valem só o primeiro.
- **Contagem regressiva (3-2-1):** antes de CADA música há uma contagem de `COUNTDOWN_MS` (padrão 3000 ms; 0 desliga).
  - O servidor cria a rodada já com `startedAt` = o **"valendo"** (agora + contagem) e `countdownMs`; a pontuação e o prazo contam a partir de `startedAt`.
  - Respostas antes do "valendo" são recusadas (`too_early`), com folga de 250 ms (`EARLY_GRACE_MS`) para a latência do celular; nunca valem tempo negativo.
  - **TV:** mostra "Prepare-se!" e 3, 2, 1 (a contagem divide `countdownMs` em 3 partes iguais); a pergunta e as opções ficam escondidas até o "valendo". O áudio é **pré-carregado** durante a contagem e **só toca no "valendo"** (`HostAudio` agenda o play pelo relógio do servidor, sem reiniciar a música quando o offset do relógio muda).
  - **Celular:** os botões ficam travados e escurecidos, com o número sobre eles, até o "valendo".
  - A renovação do link de áudio acontece **antes** de fixar o "valendo", então a busca nunca come a contagem.
  - Snapshots salvos antes da contagem existir (sem `countdownMs`) são lidos como "sem contagem".
- **Rodada:** 4 opções (▲ vermelho, ◆ azul, ● amarelo, ■ verde). A posição da correta é sorteada em
  `buildRound`. As 3 alternativas erradas são do **mesmo gênero** da música do turno
  (`selectRoundTracks`); só se aquele gênero tiver faixas de menos o servidor completa com outros gêneros.
  A resposta certa **nunca** é enviada ao controller antes da revelação.
- **Pontuação** (`scoring.ts`): 1000 pts em t=0, decaindo linearmente até 300 ao fim do tempo.
  Erro ou sem resposta = 0 e zera a sequência (`streak`).
- **Fim:** após `totalRounds` (padrão 12). Revanche por maioria simples dos conectados.
