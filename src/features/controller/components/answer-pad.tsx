"use client";

import { countdownStep } from "@/features/game";
import type { RoomView } from "@/features/realtime/protocol";
import { useCountdown } from "@/features/realtime/client/hooks";
import { Avatar, ProgressBar, SHAPES, ShapeIcon } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n/provider";

interface AnswerPadProps {
  view: RoomView;
  playerId: string;
  onAnswer(choice: number): void;
}

export function AnswerPad({ view, playerId, onAnswer }: AnswerPadProps) {
  const { t, n } = useI18n();
  const round = view.round!;
  const me = view.players.find((p) => p.id === playerId);
  const reveal = round.reveal;
  const result = reveal?.results[playerId];
  const chosen = view.you?.answer ?? null;
  const seconds = useCountdown(round.startedAt + round.durationMs);
  const playing = view.phase === "playing";
  const answered = chosen !== null;
  const toGo = useCountdown(round.startedAt); // segundos até o "valendo"
  const step = playing && round.countdownMs > 0 ? countdownStep(toGo * 1000, round.countdownMs) : null;
  const counting = step !== null; // contagem 3-2-1: respostas ainda fechadas

  let feedback = { title: t("play.question"), detail: t("pad.hint"), tone: "neutral" };
  if (counting) feedback = { title: t("pad.getReady"), detail: t("pad.getReadyHint"), tone: "neutral" };
  if (playing && answered) feedback = { title: t("pad.sent"), detail: t("pad.waitOthers"), tone: "wait" };
  if (reveal && result?.correct)
    feedback = {
      title: t("pad.correct", { points: result.points }),
      detail: t("pad.answeredIn", {
        s: n((result.elapsedMs ?? 0) / 1000, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      }),
      tone: "ok",
    };
  if (reveal && result && !result.correct)
    feedback = answered
      ? { title: t("pad.wrong"), detail: t("pad.wrongHint"), tone: "bad" }
      : { title: t("pad.none"), detail: t("pad.noneHint"), tone: "late" };

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
          <p className="text-[10px] font-extrabold tracking-[0.12em] text-muted">{t("pad.points")}</p>
          <p className="text-xl font-black text-cyan">{n(me?.score ?? 0)}</p>
        </div>
      </div>

      <div className="flex justify-between text-xs font-bold text-muted">
        <span>
          {t("round.short", { n: round.index + 1, total: view.totalRounds })}
        </span>
        <span>
          {counting
            ? `0:${String(Math.ceil(round.durationMs / 1000)).padStart(2, "0")}`
            : playing
              ? `0:${String(Math.ceil(seconds)).padStart(2, "0")}`
              : t("pad.reveal")}
        </span>
      </div>
      <ProgressBar label={t("pad.timeLabel")} value={playing && !counting ? (seconds * 1000 * 100) / round.durationMs : 100} fillClassName={playing ? "bg-cyan" : "bg-muted"} />

      <div className="relative grid flex-1 grid-cols-2 gap-3">
        {counting && (
          <div
            key={step}
            data-testid="pad-countdown"
            data-step={step}
            role="timer"
            aria-label={t("play.startsIn", { n: step })}
            className="text-brand animate-count-pop pointer-events-none absolute inset-0 z-10 flex select-none items-center justify-center text-[9rem] font-black leading-none drop-shadow-[0_0_30px_#ff0080aa]"
          >
            {step}
          </div>
        )}
        {SHAPES.map((shape, i) => {
          const isChosen = chosen === i;
          const isCorrect = reveal?.correctIndex === i;
          const dim = reveal ? !isCorrect && !isChosen : answered && !isChosen;
          return (
            <button
              key={shape.key}
              type="button"
              data-testid={`answer-${i}`}
              aria-label={t(shape.key)}
              aria-pressed={isChosen}
              disabled={!playing || answered || counting}
              onClick={() => {
                navigator.vibrate?.(30);
                onAnswer(i);
              }}
              className={cn(
                "flex items-center justify-center rounded-3xl outline-offset-[3px] transition active:scale-95",
                dim ? "opacity-20" : counting ? "opacity-30" : "opacity-100",
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
