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

- O arquivo do logo (`public/brand/deezer/Signatures-PoweredBy-DE.svg`, assinatura **"Powered by Deezer"**, vetorial, 2500×367, branca sobre transparente) **não faz parte do repositório**: ver "Por que o arquivo não é versionado" abaixo.
- Quando existe, é servido sem alteração, recolorização ou recodificação (`<Image unoptimized>`) e é inerte (só `<path>`).
- Componente `DeezerLogo` (`src/components/ui/deezer-logo.tsx`): só escala proporcionalmente; sem efeitos, animação ou link.
  O texto alternativo é o da própria imagem, "Powered by Deezer", igual nos três idiomas.
- Onde aparece:
  - **Tela inicial**: barra superior **no fluxo da página** (logo à esquerda, idioma à direita), 40 px de altura. Não é um elemento solto sobre o conteúdo: em janelas baixas o título nunca o cobre;
  - **TV**: rodapé fixo em **todas** as telas (lobby, votação, rodada, revelação, ranking), 36 px de altura, à esquerda, com os controles de idioma/som à direita. É um rodapé de 4,5 rem *reservado no layout* e `sticky` na base da janela: nunca cobre conteúdo e continua visível mesmo quando a tela é mais alta que a janela;
  - **Celular**: formulário de entrada, no **topo** (32 px), para ficar visível sem rolar mesmo em telas pequenas (320×568). As telas de jogo do celular não tocam nem mostram nada do catálogo.
- Por ser branco, **só pode ser usado sobre fundo escuro** (todo o app é escuro).
- O arquivo não tem margem própria: o layout deixa espaço livre ≥ metade da altura do logo ao redor (rodapé da TV: 4,5 rem com logo de 36 px = 18 px acima e abaixo).
- A assinatura é bem mais comprida (≈6,8:1) que o logo horizontal usado antes; as alturas foram aumentadas para o texto "Powered by" continuar legível.

**Testes** (`deezer-logo.test.tsx` e `e2e/branding.spec.ts`): se há cópia local, o arquivo mantém as dimensões do kit e é inerte; o logo (ou o texto de plano B) carrega (não é imagem quebrada), tem ≥ 28 px, mantém a proporção, está dentro da tela, com opacidade 1
e **nada o cobre** (amostra uma grade de pontos sobre toda a área), em cada fase da TV, nas páginas de entrada,
em telas de 360 px e 1920 px, em **janelas baixas** (640×360, 568×320, 800×600) e nos três idiomas.

**Em dev**, o botão "N" do Next ficava exatamente sobre o logo (canto inferior esquerdo); por isso
`devIndicators: false` em `next.config.ts` (só esconde o botão; overlays de erro continuam).

**O que NÃO foi verificado** (as diretrizes visuais de `deezerbrand.com` exigem navegador e não foram lidas; os Termos de Uso do Brand Hub foram): tamanho mínimo exigido, medida oficial do espaço livre, versões de cor permitidas e outras
proibições. Os valores acima são conservadores, mas **conferir as regras em https://deezerbrand.com/** antes de publicar.

**Termos da API** (https://developers.deezer.com/termsofuse): o uso é restrito a fins **não comerciais**, os
serviços não podem ser associados a marca/logo de terceiros e outros usos precisam de aprovação prévia da Deezer.
Se o BeatRush Party for público ou monetizado, confirmar a conformidade com a Deezer antes.

### Por que o arquivo não é versionado

Os [Termos de Uso do Brand Hub](https://deezerbrand.com/) estabelecem que:
- quem não recebeu login do Deezer **não pode baixar, usar nem reproduzir** os Brand Assets;
- quem recebeu só pode usá-los "to the extent necessary" para cumprir um acordo ou **autorização escrita** do Deezer;
- é proibido **alterá-los** e **comunicá-los a terceiros** sem autorização escrita.

Publicar o arquivo em um repositório público seria repassá-lo a terceiros. Por isso `public/brand/` está no `.gitignore`
(testes garantem que nada ali é rastreado) e cada operador usa a sua cópia autorizada. **Sem o arquivo**, `DeezerLogo`
mostra o texto "Powered by Deezer" (plano B para desenvolvimento e para quem clona o repositório; não substitui o logo
oficial em uma instância publicada). A pasta `public/brand/` fica fora do git, então ao implantar a cópia precisa ser
colocada no servidor por outro meio (ex.: etapa de deploy ou volume).

> Dúvidas sobre o uso do kit: deezerbrand@deezer.com. Se quiser incluir o logo no repositório, obtenha antes autorização **escrita** do Deezer.

## Aviso "Sobre" (direitos e uso não comercial)

Um botão **Sobre** abre um diálogo (`AboutDialog`, `src/components/ui/about-dialog.tsx`) informando que:

1. o app **não é detentor dos direitos das músicas** nem **fornecedor** de conteúdo musical: apenas **consome o Deezer** (áudio, capas e dados pertencem a seus titulares);
2. os trechos tocam direto do Deezer; o app **não armazena nem redistribui arquivos de áudio**;
3. Deezer e seu logotipo são marcas de seus titulares e o app **não é afiliado, patrocinado nem endossado** por ele;
4. o uso é **exclusivamente não comercial**.

- Textos em `about.*` (pt-BR, en, es). O aviso muda de idioma junto com o app.
- Aparece na **tela inicial**, no **rodapé da TV** (ao lado do logo) e no **formulário de entrada do celular**.
- É um **modal** (`<dialog>` nativo), não uma página: na TV, navegar para outra rota abandonaria a sala em andamento. Abrir o Sobre não pausa nem interrompe a partida.
- Acessível: foco entra no diálogo e volta ao botão ao fechar, Esc fecha, clicar no fundo fecha, abre no topo e rola por dentro em telas pequenas (320×568).
- Testes: `about-dialog.test.tsx` (conteúdo nos 3 idiomas, abrir/fechar) e `e2e/about.spec.ts` (inclui abrir durante a partida e telas pequenas).

> A frase 3 (sem afiliação/endosso) foi acrescentada por precaução; remova as chaves `about.trademark` se não quiser. Os textos são informativos e
> **não substituem revisão jurídica**.

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
