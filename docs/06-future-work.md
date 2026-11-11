# Trabalho futuro

Itens identificados mas **adiados** de propósito. Cada um deve virar uma branch própria quando for priorizado.

## 1. Precisão de gênero no Deezer (playlists/charts em vez de busca por texto)

**Situação atual:** `DEEZER_QUERIES` (`src/features/music/providers/deezer.ts`) usa `search?q=…`.
Para gêneros como "Anos 80", "Sertanejo", "Funk" e "MPB" isso é busca por palavra-chave, e mesmo
o filtro `genre:"pop"` não é uma categoria oficial: em teste (2026-11-10) o primeiro resultado foi
uma faixa chamada literalmente "Genre: Pop" de um artista aleatório. Resultado: músicas que não
combinam com o gênero votado e qualidade irregular.

**Proposta:** trocar a busca por fontes curadas, que também **não exigem chave**:
- `GET /chart/{genre_id}/tracks` para gêneros com id oficial (Pop, Rock, Rap/Hip Hop, Electro…);
- playlists públicas curadas (`GET /playlist/{id}/tracks`) para gêneros sem categoria própria
  (Anos 80, Sertanejo, Funk, MPB), com os ids em um mapa `Genre -> { type, id }`;
- manter a busca por texto apenas como fallback.

**Pontos de atenção:**
- A interface `MusicProvider` não muda; a alteração fica restrita ao adaptador do Deezer.
- Os ids de playlist precisam ser escolhidos manualmente e revisados de tempos em tempos.
- Testes: ampliar `music.test.ts` com respostas simuladas de chart/playlist e do fallback.
- Os links de `preview` são assinados e expiram; continuar buscando as faixas ao montar a partida.

