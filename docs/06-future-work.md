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

## 2. Multi-instância (escalar horizontalmente)

Hoje há **uma instância** Node com estado persistido no Redis (`08-persistence-redis.md`). Para várias:
- **pub/sub** (Redis) para espalhar o estado da sala às instâncias que têm conexões dela;
- **dono da sala** com lock/lease (ex.: `SET NX PX` renovado) para que só uma instância arme os timers,
  com failover quando o dono cair;
- roteamento/sticky sessions para as conexões de uma sala;
- trocar o `restore()` de boot por carregamento sob demanda (`room_not_found` → tenta o Redis).
Só vale se uma instância deixar de bastar (ela comporta muitas salas pequenas).

## 3. Renovar o link de preview ao iniciar cada rodada

Os links de preview do Deezer expiram em ~14 min. A fila de músicas sorteadas é persistida com a sala,
então após restaurar uma sala muito depois os links podem ter vencido. Solução: guardar só o id da faixa
na fila e buscar o link atual (`GET /track/{id}`) no início de cada rodada. Decidimos **não** ter cache
de faixas por esse mesmo motivo.
