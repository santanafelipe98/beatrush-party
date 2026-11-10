# Provedores de música

## Decisão

A plataforma (Deezer ou Spotify) ainda não está definida, então o jogo depende apenas da porta
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
| `spotify` | esqueleto | Lança `MusicProviderError`. Ver ressalvas abaixo. |

A seleção é por variável de ambiente `MUSIC_PROVIDER` (`createMusicProvider`). Padrão: `deezer`.

## Onde o provedor roda

Apenas no **servidor** (processo do WebSocket). Motivos: a API do Deezer não envia CORS, chaves do
Spotify não podem ir ao browser, e o servidor precisa sortear as rodadas e manter a resposta correta
em segredo. O Host recebe somente `previewUrl` e toca o áudio com `<audio>`; controllers nunca
recebem URLs de áudio.

## Sorteio de rodadas

`selectRoundTracks` busca um pool por gênero vencedor, remove duplicatas (título+artista), alterna
entre gêneros e escolhe 3 distratores por faixa. `buildRound` (domínio) embaralha as 4 opções.

## Ressalvas do Spotify

- `preview_url` foi descontinuado para muitos apps; reprodução provavelmente exigirá o Web Playback
  SDK (conta Premium) no Host, o que muda `Track` (ex.: `playbackUri`). A mudança fica restrita ao
  adaptador e ao componente de áudio do Host.
- Autenticação por Client Credentials ficaria em variáveis de ambiente do servidor.
