import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createHealthHandler, type HealthOptions } from "./health";

let server: Server | undefined;
afterEach(() => new Promise<void>((r) => (server ? server.close(() => r()) : r())));

/** Sobe um servidor real com o handler; o resto das rotas responde "next". */
async function start(opts: Partial<HealthOptions> = {}) {
  const state = { ready: true, draining: false };
  const handler = createHealthHandler({
    isReady: () => state.ready,
    isDraining: () => state.draining,
    ...opts,
  });
  server = createServer((req, res) => {
    if (handler(req, res)) return;
    res.end("next");
  });
  await new Promise<void>((r) => server!.listen(0, r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { state, base, get: (p: string, init?: RequestInit) => fetch(base + p, init) };
}

describe("GET /healthz (liveness)", () => {
  it("200 com status ok, sem cache, e /health é um alias", async () => {
    const { get } = await start();
    for (const path of ["/healthz", "/health"]) {
      const res = await get(path);
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(res.headers.get("content-type")).toContain("application/json");
      expect(await res.json()).toMatchObject({ status: "ok", uptimeSeconds: expect.any(Number) });
    }
  });

  it("segue 200 mesmo subindo, desligando ou com o Redis fora (não reinicia o app à toa)", async () => {
    const { get, state } = await start({ pingRedis: () => Promise.reject(new Error("down")) });
    state.ready = false;
    state.draining = true;
    expect((await get("/healthz")).status).toBe(200);
  });

  it("ignora query string e aceita HEAD sem corpo", async () => {
    const { get } = await start();
    expect((await get("/healthz?probe=1")).status).toBe(200);
    const head = await get("/healthz", { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
  });
});

describe("GET /readyz (readiness)", () => {
  it("503 'starting' enquanto o app sobe, 200 quando fica pronto", async () => {
    const { get, state } = await start();
    state.ready = false;
    const starting = await get("/readyz");
    expect(starting.status).toBe(503);
    expect(await starting.json()).toMatchObject({ status: "starting" });
    state.ready = true;
    const ok = await get("/readyz");
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ status: "ok", checks: { app: "up", redis: "disabled" } });
  });

  it("503 'draining' ao desligar, mesmo estando pronto (tira da rotação)", async () => {
    const { get, state } = await start();
    state.draining = true;
    const res = await get("/readyz");
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ status: "draining" });
  });

  it("com Redis respondendo: ok e redis 'up'", async () => {
    const { get } = await start({ pingRedis: async () => {} });
    expect(await (await get("/readyz")).json()).toMatchObject({ status: "ok", checks: { redis: "up" } });
  });

  it("Redis fora: continua 200, mas 'degraded' (o jogo segue em memória)", async () => {
    const { get } = await start({ pingRedis: () => Promise.reject(new Error("ECONNREFUSED")) });
    const res = await get("/readyz");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "degraded", checks: { app: "up", redis: "down" } });
  });

  it("Redis que não responde não trava o healthcheck: estoura o tempo e vira 'down'", async () => {
    const { get } = await start({ pingRedis: () => new Promise(() => {}), redisTimeoutMs: 50 });
    const t0 = Date.now();
    const res = await get("/readyz");
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(await res.json()).toMatchObject({ status: "degraded", checks: { redis: "down" } });
  });

  it("não vaza detalhes do erro do Redis", async () => {
    const { get } = await start({ pingRedis: () => Promise.reject(new Error("senha=secreta host=10.0.0.5")) });
    expect(await (await get("/readyz")).text()).not.toMatch(/secreta|10\.0\.0\.5/);
  });
});

describe("roteamento", () => {
  it("outros métodos em rotas de saúde dão 405 com Allow", async () => {
    const { get } = await start();
    const res = await get("/healthz", { method: "POST" });
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("GET, HEAD");
  });

  it("qualquer outra rota passa para o servidor (ex.: Next)", async () => {
    const { get } = await start();
    expect(await (await get("/play")).text()).toBe("next");
    expect(await (await get("/healthz/extra")).text()).toBe("next");
    expect(await (await get("/healthzz")).text()).toBe("next");
  });
});
