"use client";

import type { RoomView } from "@/features/realtime/protocol";
import { useCountdown } from "@/features/realtime/client/hooks";
import { Avatar, ProgressBar, SHAPES, ShapeIcon } from "@/components/ui";
import { cn } from "@/lib/cn";

interface AnswerPadProps {
  view: RoomView;
  playerId: string;
  onAnswer(choice: number): void;
}

export function AnswerPad({ view, playerId, onAnswer }: AnswerPadProps) {
  const round = view.round!;
  const me = view.players.find((p) => p.id === playerId);
  const reveal = round.reveal;
  const result = reveal?.results[playerId];
  const chosen = view.you?.answer ?? null;
  const seconds = useCountdown(round.startedAt + round.durationMs);
  const playing = view.phase === "playing";
  const answered = chosen !== null;

  let feedback = { title: "Qual é a música?", detail: "Toque na forma que aparece na TV", tone: "neutral" };
  if (playing && answered) feedback = { title: "Resposta enviada", detail: "Aguardando os outros jogadores…", tone: "wait" };
  if (reveal && result?.correct)
    feedback = { title: `Acertou! +${result.points}`, detail: `Resposta em ${((result.elapsedMs ?? 0) / 1000).toFixed(1).replace(".", ",")}s`, tone: "ok" };
  if (reveal && result && !result.correct)
    feedback = answered
      ? { title: "Errou · +0", detail: "A resposta certa era o verde", tone: "bad" }
      : { title: "Sem resposta", detail: "Tempo esgotado · próxima música já!", tone: "late" };

  const tones: Record<string, string> = {
    neutral: "border-line bg-surface",
    wait: "border-line bg-surface text-cyan",
    ok: "border-green bg-green/15 text-green",
    bad: "border-red bg-red/15 text-red",
    late: "border-amber bg-amber/15 text-amber",
  };

  return (
    <div
      className={cn(
        "mx-auto flex min-h-dvh w-full max-w-sm flex-col gap-3.5 px-4 pb-5 pt-10",
        reveal && result?.correct && "bg-[radial-gradient(ellipse_at_50%_90%,#0a4a38,#0f0f12_75%)]",
        reveal && result && !result.correct && "bg-[radial-gradient(ellipse_at_50%_90%,#4a1010,#0f0f12_75%)]",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Avatar name={me?.name ?? "?"} avatar={me?.avatar ?? 0} size={34} />
          <span className="text-[17px] font-extrabold">{me?.name}</span>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-extrabold tracking-[0.12em] text-muted">PONTOS</p>
          <p className="text-xl font-black text-cyan">{(me?.score ?? 0).toLocaleString("pt-BR")}</p>
        </div>
      </div>

      <div className="flex justify-between text-xs font-bold text-muted">
        <span>
          Música {round.index + 1}/{view.totalRounds}
        </span>
        <span>{playing ? `0:${String(Math.ceil(seconds)).padStart(2, "0")}` : "Revelação"}</span>
      </div>
      <ProgressBar label="tempo" value={playing ? (seconds * 1000 * 100) / round.durationMs : 100} fillClassName={playing ? "bg-cyan" : "bg-muted"} />

      <div className="grid flex-1 grid-cols-2 gap-3">
        {SHAPES.map((shape, i) => {
          const isChosen = chosen === i;
          const isCorrect = reveal?.correctIndex === i;
          const dim = reveal ? !isCorrect && !isChosen : answered && !isChosen;
          return (
            <button
              key={shape.name}
              type="button"
              data-testid={`answer-${i}`}
              aria-label={shape.name}
              aria-pressed={isChosen}
              disabled={!playing || answered}
              onClick={() => {
                navigator.vibrate?.(30);
                onAnswer(i);
              }}
              className={cn(
                "flex items-center justify-center rounded-3xl outline-offset-[3px] transition active:scale-95",
                dim ? "opacity-20" : "opacity-100",
                isChosen && !reveal && "outline-4 outline-white",
                reveal && isCorrect && "shadow-[0_0_30px_#10B981] outline-4 outline-green",
                reveal && isChosen && !isCorrect && "outline-4 outline-red",
              )}
              style={{ background: shape.color }}
            >
              <ShapeIcon index={i} className="size-11" />
            </button>
          );
        })}
      </div>

      <div
        role="status"
        className={cn("flex h-20 flex-col items-center justify-center rounded-2xl border text-center", tones[feedback.tone])}
      >
        <p className="text-lg font-black">{feedback.title}</p>
        <p className="mt-0.5 text-xs font-semibold text-soft">{feedback.detail}</p>
      </div>
    </div>
  );
}
