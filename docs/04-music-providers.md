# Provedores de música

## Decisão

A plataforma de música é o Deezer, mas o jogo depende apenas da porta
`MusicProvider` (`src/features/music/provider.ts`):

```ts
interface MusicProvider {
  id: string;
  getTracksByGenre(genre: Genre, limit: number): Promise<Track[]>;
  /** Opcional: busca uma faixa pelo id para obter um previewUrl atual. */
  getTrack?(id: string): Promise<Track | null>;
}
```

Adaptadores em `src/features/music/providers/`:

| Adaptador | Status | Observações |
| --- | --- | --- |
| `mock` | pronto | Catálogo determinístico e offline. Usado em testes e e2e (`MUSIC_PROVIDER=mock`). |
| `deezer` | pronto | API pública sem chave; faixas por gênero via charts/rádios curados, usa `preview` (MP3 de 30s). |

A seleção é por variável de ambiente `MUSIC_PROVIDER` (`createMusicProvider`). Padrão: `deezer`.

## Onde o provedor roda

Apenas no **servidor** (processo do WebSocket). Motivos: a API do Deezer não envia CORS, e
o servidor precisa sortear as rodadas e manter a resposta correta
em segredo. O Host recebe somente `previewUrl` e toca o áudio com `<audio>`; controllers nunca
recebem URLs de áudio.

## Sorteio de rodadas

`selectRoundTracks` busca um pool por gênero vencedor, remove duplicatas (título+artista), alterna
entre gêneros e escolhe 3 distratores por faixa. `buildRound` (domínio) embaralha as 4 opções.

## Link de áudio renovado a cada rodada

Os links de `preview` do Deezer são **assinados e expiram em ~14 min**. Para nunca tocar um link vencido
(partida longa, fila sorteada há tempo ou sala restaurada após um reinício), o `RoomManager` chama
`getTrack(id)` **no início de cada rodada** e usa o link devolvido (`GET /track/{id}`, sem chave).

- Só o `previewUrl` e a capa são trocados; título, artista e opções continuam os do sorteio.
- Se a busca falhar, demorar mais que `previewRefreshMs` (2,5 s) ou não trouxer link, a rodada usa o link que já tinha. O jogo nunca trava por isso.
- `startedAt` da rodada só é marcado **depois** da renovação: ninguém perde tempo de resposta com a busca.
- O Deezer responde `200` com `{ "error": … }` para faixa removida; vira `null`. Ids que não começam com `deezer-` (ex.: faixas do mock usado como fallback) viram `null` sem chamar a API.
- Provedores sem `getTrack` (mock) simplesmente não renovam.

## Catálogo de gêneros (Deezer)

Cada gênero do jogo aponta para uma fonte fixa em `providers/deezer-catalog.ts`:

| Gênero | Fonte |
| --- | --- |
| Pop | chart 132 |
| Rock | chart 152 |
| Hip-Hop | chart 116 (Rap/Hip Hop) |
| Anos 80 | rádio 38305 (não existe gênero oficial) |
| Sertanejo | chart 80 |
| Funk | chart 472 (Rap/Funk Brasileiro) |
| MPB | chart 78 |
| Eletrônica | chart 106 (Electro) |

Os ids vêm de `GET https://api.deezer.com/genre` (lista oficial). Para trocar uma fonte, edite o mapa.
Evoluções planejadas: [06-future-work.md](06-future-work.md).

## Histórico

Um esqueleto de adaptador Spotify existiu no início e foi removido por não ser necessário. A porta
`MusicProvider` continua isolando o catálogo: um novo provedor exige apenas um adaptador em
`providers/` e um `case` em `createMusicProvider`. Se o Spotify voltar a ser considerado, note que
`preview_url` foi descontinuado para muitos apps e a reprodução provavelmente exigiria o Web
Playback SDK (conta Premium) no Host, alterando `Track` (ex.: `playbackUri`).
