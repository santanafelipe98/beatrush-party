const COLORS = ["#FF0080", "#7928CA", "#00DFD8", "#F59E0B", "#10B981"];

/** Pseudoaleatório determinístico (mesmo resultado no servidor e no cliente: sem erro de hidratação). */
const rnd = (i: number) => {
  const x = Math.sin(i * 91.7) * 10000;
  return x - Math.floor(x);
};

/** Confete caindo em loop, atrás do conteúdo. Puro CSS. */
export function Confetti({ count = 36 }: { count?: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: count }, (_, i) => {
        const w = 6 + Math.floor(rnd(i + 9) * 8);
        const duration = 5 + rnd(i + 21) * 5;
        return (
          <span
            key={i}
            className="absolute top-0 opacity-80"
            style={
              {
                left: `${Math.floor(rnd(i) * 100)}%`,
                width: w,
                height: 10 + Math.floor(rnd(i + 3) * 10),
                background: COLORS[i % COLORS.length],
                "--r": `${Math.floor(rnd(i + 7) * 180)}deg`,
                animation: `confetti-fall ${duration.toFixed(1)}s linear ${(-rnd(i + 40) * duration).toFixed(1)}s infinite`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
