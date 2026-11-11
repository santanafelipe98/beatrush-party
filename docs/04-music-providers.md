# Provedores de música

## Decisão

A plataforma de música é o Deezer, mas o jogo depende apenas da porta
`MusicProvider` (`src/features/music/provider.ts`):

```ts
interface MusicProvider {
  id: string;
  getTracksByGenre(genre: Genre, limit: number): Promise<Track[]>;
}
```

Adaptadores em `src/features/music/providers/`:

| Adaptador | Status | Observações |
| --- | --- | --- |
| `mock` | pronto | Catálogo determinístico e offline. Usado em testes e e2e (`MUSIC_PROVIDER=mock`). |
| `deezer` | pronto | API pública sem chave; busca por gênero, usa `preview` (MP3 de 30s). |

A seleção é por variável de ambiente `MUSIC_PROVIDER` (`createMusicProvider`). Padrão: `deezer`.

## Onde o provedor roda

Apenas no **servidor** (processo do WebSocket). Motivos: a API do Deezer não envia CORS, e
o servidor precisa sortear as rodadas e manter a resposta correta
em segredo. O Host recebe somente `previewUrl` e toca o áudio com `<audio>`; controllers nunca
recebem URLs de áudio.

## Sorteio de rodadas

`selectRoundTracks` busca um pool por gênero vencedor, remove duplicatas (título+artista), alterna
entre gêneros e escolhe 3 distratores por faixa. `buildRound` (domínio) embaralha as 4 opções.

> Melhorias planejadas para o adaptador Deezer: ver [06-future-work.md](06-future-work.md).

## Histórico

Um esqueleto de adaptador Spotify existiu no início e foi removido por não ser necessário. A porta
`MusicProvider` continua isolando o catálogo: um novo provedor exige apenas um adaptador em
`providers/` e um `case` em `createMusicProvider`. Se o Spotify voltar a ser considerado, note que
`preview_url` foi descontinuado para muitos apps e a reprodução provavelmente exigiria o Web
Playback SDK (conta Premium) no Host, alterando `Track` (ex.: `playbackUri`).
