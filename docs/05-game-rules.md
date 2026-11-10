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
- **Rodada:** 4 opções (▲ vermelho, ◆ azul, ● amarelo, ■ verde). A posição da correta é sorteada em
  `buildRound`. A resposta certa **nunca** é enviada ao controller antes da revelação.
- **Pontuação** (`scoring.ts`): 1000 pts em t=0, decaindo linearmente até 300 ao fim do tempo.
  Erro ou sem resposta = 0 e zera a sequência (`streak`).
- **Fim:** após `totalRounds` (padrão 12). Revanche por maioria simples dos conectados.
