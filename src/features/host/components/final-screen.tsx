import type { RoomView } from "@/features/realtime/protocol";
import { Avatar, Confetti } from "@/components/ui";

const PODIUM = [
  { place: 2, h: 130, bg: "linear-gradient(#e4e6f0,#9a9cb0)", glow: "#ffffff33" },
  { place: 1, h: 180, bg: "linear-gradient(#ffd75e,#F59E0B)", glow: "#F59E0B88" },
  { place: 3, h: 95, bg: "linear-gradient(#e0a06a,#a8693a)", glow: "#a8693a55" },
];

const fmt = (n: number) => n.toLocaleString("pt-BR");

export function FinalScreen({ view }: { view: RoomView }) {
  const sorted = [...view.players].sort((a, b) => b.score - a.score || b.bestStreak - a.bestStreak);

  return (
    <div className="relative grid min-h-dvh grid-cols-1 gap-8 overflow-hidden bg-[radial-gradient(ellipse_at_50%_0%,#3d1070,#0f0f12_65%)] p-8 lg:grid-cols-2">
      <Confetti />
      <section className="relative flex flex-col">
        <h1 className="text-3xl font-black">Fim de jogo!</h1>
        <div className="flex flex-1 items-end justify-center gap-2.5">
          {PODIUM.map(({ place, h, bg, glow }) => {
            const p = sorted[place - 1];
            if (!p) return null;
            return (
              <div key={place} className="flex w-28 flex-col items-center">
                <Avatar name={p.name} avatar={p.avatar} size={58} glow />
                <p className="my-1.5 text-base font-extrabold">{p.name}</p>
                <div
                  className="animate-rise flex w-full origin-bottom flex-col items-center rounded-t-xl pt-2.5 text-bg"
                  style={{ height: h, background: bg, boxShadow: `0 0 30px ${glow}`, animationDelay: `${place === 1 ? 0.9 : place === 2 ? 0.5 : 0.1}s` }}
                >
                  <span className="text-4xl font-black leading-none">{place}</span>
                  <span className="text-xs font-extrabold">{fmt(p.score)} pts</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="relative flex flex-col pt-1.5">
        <div className="grid grid-cols-[30px_1fr_80px_60px] px-3.5 pb-2 text-xs font-extrabold tracking-[0.12em] text-muted">
          <span>#</span>
          <span>JOGADOR</span>
          <span>PTS</span>
          <span>SEQ.</span>
        </div>
        <ol className="flex flex-col gap-2">
          {sorted.map((p, i) => (
            <li
              key={p.id}
              data-testid="ranking-row"
              className="grid grid-cols-[30px_1fr_80px_60px] items-center rounded-xl border border-line bg-surface/90 px-3.5 py-3 text-lg font-extrabold"
            >
              <span className={i === 0 ? "text-amber" : "text-muted"}>{i + 1}</span>
              <span>{p.name}</span>
              <span>{fmt(p.score)}</span>
              <span className="text-amber">×{p.bestStreak}</span>
            </li>
          ))}
        </ol>
        <p className="mt-auto rounded-xl bg-brand p-4 text-center text-lg font-extrabold">
          Jogar novamente? {view.replayVotes.length}/{view.players.length} votos nos celulares
        </p>
      </section>
    </div>
  );
}
