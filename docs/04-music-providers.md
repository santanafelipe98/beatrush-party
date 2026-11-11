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

## Logo do Deezer (exigência da API)

As [diretrizes do Deezer](https://developers.deezer.com/guidelines/logo) exigem que todo app que usa a API
"must have to include a clearly visible Deezer Logo" ("Deezer Logo must be clearly visible and identified").

**Implementação**

- Arquivo oficial do kit de marca em `public/brand/deezer/Signatures-PoweredBy-DE.svg`: a assinatura **"Powered by Deezer"** (vetorial, 2500×367, **branca sobre transparente**).
  Não foi alterado, recolorido nem recodificado (`<Image unoptimized>`). É inerte (só `<path>`), o que o teste garante.
- Componente `DeezerLogo` (`src/components/ui/deezer-logo.tsx`): só escala proporcionalmente; sem efeitos, animação ou link.
  O texto alternativo é o da própria imagem, "Powered by Deezer", igual nos três idiomas.
- Onde aparece:
  - **Tela inicial**: barra superior **no fluxo da página** (logo à esquerda, idioma à direita), 40 px de altura. Não é um elemento solto sobre o conteúdo: em janelas baixas o título nunca o cobre;
  - **TV**: rodapé fixo em **todas** as telas (lobby, votação, rodada, revelação, ranking), 36 px de altura, à esquerda, com os controles de idioma/som à direita. É um rodapé de 4,5 rem *reservado no layout* e `sticky` na base da janela: nunca cobre conteúdo e continua visível mesmo quando a tela é mais alta que a janela;
  - **Celular**: formulário de entrada, no **topo** (32 px), para ficar visível sem rolar mesmo em telas pequenas (320×568). As telas de jogo do celular não tocam nem mostram nada do catálogo.
- Por ser branco, **só pode ser usado sobre fundo escuro** (todo o app é escuro).
- O arquivo não tem margem própria: o layout deixa espaço livre ≥ metade da altura do logo ao redor (rodapé da TV: 4,5 rem com logo de 36 px = 18 px acima e abaixo).
- A assinatura é bem mais comprida (≈6,8:1) que o logo horizontal usado antes; as alturas foram aumentadas para o texto "Powered by" continuar legível.

**Testes** (`deezer-logo.test.tsx` e `e2e/branding.spec.ts`): o arquivo existe e mantém as dimensões do kit;
o logo carrega (não é imagem quebrada), tem ≥ 28 px, mantém a proporção, está dentro da tela, com opacidade 1
e **nada o cobre** (amostra uma grade de pontos sobre toda a área), em cada fase da TV, nas páginas de entrada,
em telas de 360 px e 1920 px, em **janelas baixas** (640×360, 568×320, 800×600) e nos três idiomas.

**Em dev**, o botão "N" do Next ficava exatamente sobre o logo (canto inferior esquerdo); por isso
`devIndicators: false` em `next.config.ts` (só esconde o botão; overlays de erro continuam).

**O que NÃO foi verificado** (o site `deezerbrand.com` é renderizado por JavaScript e não pôde ser lido
automaticamente): tamanho mínimo exigido, medida oficial do espaço livre, versões de cor permitidas e outras
proibições. Os valores acima são conservadores, mas **conferir as regras em https://deezerbrand.com/** antes de publicar.

**Termos da API** (https://developers.deezer.com/termsofuse): o uso é restrito a fins **não comerciais**, os
serviços não podem ser associados a marca/logo de terceiros e outros usos precisam de aprovação prévia da Deezer.
Se o BeatRush Party for público ou monetizado, confirmar a conformidade com a Deezer antes.

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
