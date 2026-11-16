# Healthcheck

Dois endpoints, atendidos **direto pelo servidor Node** (`server.ts` → `src/server/health.ts`), antes do Next.
Por isso respondem mesmo enquanto o app sobe, não criam cookie, não passam por i18n e não carregam Analytics.

| Endpoint | Tipo | Resposta |
| --- | --- | --- |
| `GET /healthz` (alias `/health`) | **liveness**: o processo está vivo? | sempre `200 {"status":"ok","uptimeSeconds":N}` |
| `GET /readyz` | **readiness**: pode receber tráfego? | `200` pronto · `503` subindo ou desligando |

`HEAD` também funciona (sem corpo); outros métodos dão `405`. Todas as respostas têm `Cache-Control: no-store`.

## `/readyz`

```json
{ "status": "ok", "uptimeSeconds": 42, "checks": { "app": "up", "redis": "up" } }
```

| `status` | HTTP | Quando |
| --- | --- | --- |
| `starting` | 503 | Next ainda preparando ou salas sendo restauradas do Redis |
| `ok` | 200 | pronto; `redis` é `up` ou `disabled` (sem `REDIS_URL`) |
| `degraded` | 200 | pronto, mas o Redis configurado não responde (o jogo segue em memória) |
| `draining` | 503 | recebeu SIGTERM/SIGINT: está encerrando, tire da rotação |

## Decisões

- **Liveness não olha dependências.** Se o Redis cair, reiniciar o app não resolve e ainda derrubaria as partidas em
  memória. Só a readiness (e só informativamente) reporta o Redis.
- **Redis fora = `degraded` com 200**, não 503: o app foi projetado para degradar (ver `08-persistence-redis.md`) e
  tirar a instância de rotação por isso encerraria partidas que estão funcionando. Alerte em `status != ok`.
- **O HTTP sobe antes do Next.** Assim `/healthz` responde desde o início e `/readyz` mostra `starting`, em vez de a
  plataforma ver "conexão recusada" por vários segundos. Enquanto não está pronto, as demais rotas devolvem `503`
  (`Retry-After: 2`) e conexões WebSocket são recusadas.
- **Resposta mínima.** Sem versão, sem contagem de salas, sem texto de erro do Redis (nada que ajude um atacante).
- A sonda do Redis tem tempo máximo (1 s) para o healthcheck nunca ficar pendurado.

## Exemplos de configuração

Docker / Compose:
```yaml
healthcheck:
  test: ["CMD", "node", "-e", "fetch('http://localhost:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
  interval: 15s
  timeout: 3s
  retries: 3
```

Kubernetes:
```yaml
livenessProbe:  { httpGet: { path: /healthz, port: 3000 }, periodSeconds: 15 }
readinessProbe: { httpGet: { path: /readyz,  port: 3000 }, periodSeconds: 5 }
```

Plataformas PaaS (Render, Railway, Fly…): use `/healthz` (ou `/readyz`) como "health check path".

Testes: `src/server/health.test.ts` (servidor HTTP real) e `e2e/health.spec.ts`.
