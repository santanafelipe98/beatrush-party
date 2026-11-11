# Trabalho futuro

Itens identificados mas **adiados** de propósito. Cada um deve virar uma branch própria quando for priorizado.

## 1. Evoluir a curadoria de gêneros do Deezer

**Já feito:** lista fixa em `src/features/music/providers/deezer-catalog.ts`, que mapeia cada gênero
do jogo para um `chart` oficial do Deezer ou para uma rádio (ver [04-music-providers.md](04-music-providers.md)).
Isso substituiu a busca por texto, que devolvia faixas fora do gênero.

**Ainda em aberto** (por ordem de custo-benefício):
- **Validar as fontes ao subir o servidor.** Chamar cada fonte e conferir que há faixas com preview
  suficientes; gênero que falhar sai da votação, com aviso no log, em vez de quebrar a partida no
  meio. Protege contra o Deezer remover ou mudar um id.
- **Qualidade dos charts.** O Deezer classifica por conta própria e há ruído: em teste, o chart de
  Rock trouxe "Billie Jean" e o de Hip-Hop trouxe Shakira. Se incomodar, trocar a fonte por
  playlists/rádios curadas ou filtrar por artista.
- **Gêneros dinâmicos.** `GET /genre` lista os gêneros oficiais (27 hoje), mas exigiria tornar
  `Genre` um valor em tempo de execução (hoje é uma união fixa usada pelo Zod, pelo domínio e pelas
  telas) e escolher quais exibir. Só vale se a lista fixa se mostrar limitante.
- **Variação por região.** Os charts mudam conforme o país do servidor; o conjunto de músicas pode
  diferir entre ambientes.
- **Links de `preview` expiram** (são assinados); continuar buscando as faixas ao montar a partida.
