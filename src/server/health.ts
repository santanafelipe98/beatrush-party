import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Endpoints de healthcheck, atendidos direto pelo servidor Node (antes do Next), então respondem
 * mesmo durante o boot e não passam por i18n, cookies nem Analytics.
 *
 * - `GET /healthz` (alias `/health`): **liveness**. "O processo está vivo e atende HTTP?" Não consulta
 *   nenhuma dependência: uma queda do Redis não deve fazer a plataforma reiniciar o app.
 * - `GET /readyz`: **readiness**. "Pode receber tráfego?" 503 enquanto sobe (Next + restauração das salas)
 *   e ao desligar (`draining`), para o balanceador tirar a instância de rotação. Redis fora do ar NÃO
 *   derruba a prontidão (o jogo segue em memória): aparece como `degraded`.
 */
export type RedisCheck = "up" | "down" | "disabled";

export interface HealthOptions {
  /** `true` quando Next e a restauração das salas terminaram. */
  isReady(): boolean;
  /** `true` depois de SIGTERM/SIGINT: está encerrando. */
  isDraining(): boolean;
  /** Sonda o Redis; ausente quando a persistência é em memória. Deve rejeitar se ele não responde. */
  pingRedis?: () => Promise<void>;
  now?: () => number;
  /** Quanto esperar o Redis antes de dá-lo como fora do ar. */
  redisTimeoutMs?: number;
}

export type HealthHandler = (req: IncomingMessage, res: ServerResponse) => boolean;

const LIVENESS = new Set(["/healthz", "/health"]);
const READINESS = "/readyz";

function send(req: IncomingMessage, res: ServerResponse, status: number, body: unknown) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(json),
    // health nunca pode vir de cache de proxy/CDN
    "cache-control": "no-store",
  });
  res.end(req.method === "HEAD" ? undefined : json);
}

function withTimeout(p: Promise<void>, ms: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      () => (clearTimeout(timer), resolve()),
      (e) => (clearTimeout(timer), reject(e)),
    );
  });
}

/**
 * Devolve um handler que atende os endpoints de saúde e retorna `true` se tratou a requisição
 * (e `false` para o servidor seguir com o roteamento normal).
 */
export function createHealthHandler(opts: HealthOptions): HealthHandler {
  const now = opts.now ?? Date.now;
  const startedAt = now();
  const uptime = () => Math.round((now() - startedAt) / 1000);

  async function readiness(req: IncomingMessage, res: ServerResponse) {
    if (opts.isDraining()) return send(req, res, 503, { status: "draining", uptimeSeconds: uptime() });
    if (!opts.isReady()) return send(req, res, 503, { status: "starting", uptimeSeconds: uptime() });

    let redis: RedisCheck = "disabled";
    if (opts.pingRedis) {
      redis = await withTimeout(opts.pingRedis(), opts.redisTimeoutMs ?? 1_000).then(
        () => "up" as const,
        () => "down" as const,
      );
    }
    send(req, res, 200, {
      status: redis === "down" ? "degraded" : "ok",
      uptimeSeconds: uptime(),
      checks: { app: "up", redis },
    });
  }

  return (req, res) => {
    const path = (req.url ?? "").split("?")[0];
    const isLive = LIVENESS.has(path);
    if (!isLive && path !== READINESS) return false;

    if (req.method !== "GET" && req.method !== "HEAD") {
      res.setHeader("allow", "GET, HEAD");
      send(req, res, 405, { status: "method_not_allowed" });
      return true;
    }
    if (isLive) send(req, res, 200, { status: "ok", uptimeSeconds: uptime() });
    else void readiness(req, res).catch(() => send(req, res, 500, { status: "error" }));
    return true;
  };
}
