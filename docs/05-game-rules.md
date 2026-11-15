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
- **Votação de gêneros:** até 3 por jogador; vencem os 3 mais votados, empates resolvidos pela
  ordem de `GENRES` (determinístico e testável).
- **Contagem regressiva (3-2-1):** antes de CADA música há uma contagem de `COUNTDOWN_MS` (padrão 3000 ms; 0 desliga).
  - O servidor cria a rodada já com `startedAt` = o **"valendo"** (agora + contagem) e `countdownMs`; a pontuação e o prazo contam a partir de `startedAt`.
  - Respostas antes do "valendo" são recusadas (`too_early`), com folga de 250 ms (`EARLY_GRACE_MS`) para a latência do celular; nunca valem tempo negativo.
  - **TV:** mostra "Prepare-se!" e 3, 2, 1 (a contagem divide `countdownMs` em 3 partes iguais); a pergunta e as opções ficam escondidas até o "valendo". O áudio é **pré-carregado** durante a contagem e **só toca no "valendo"** (`HostAudio` agenda o play pelo relógio do servidor, sem reiniciar a música quando o offset do relógio muda).
  - **Celular:** os botões ficam travados e escurecidos, com o número sobre eles, até o "valendo".
  - A renovação do link de áudio acontece **antes** de fixar o "valendo", então a busca nunca come a contagem.
  - Snapshots salvos antes da contagem existir (sem `countdownMs`) são lidos como "sem contagem".
- **Rodada:** 4 opções (▲ vermelho, ◆ azul, ● amarelo, ■ verde). A posição da correta é sorteada em
  `buildRound`. A resposta certa **nunca** é enviada ao controller antes da revelação.
- **Pontuação** (`scoring.ts`): 1000 pts em t=0, decaindo linearmente até 300 ao fim do tempo.
  Erro ou sem resposta = 0 e zera a sequência (`streak`).
- **Fim:** após `totalRounds` (padrão 12). Revanche por maioria simples dos conectados.
