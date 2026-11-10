import { MIN_PLAYERS } from "@/features/game";
import type { RoomView } from "@/features/realtime/protocol";
import { Avatar, Button, Equalizer } from "@/components/ui";

interface WaitingScreenProps {
  view: RoomView;
  playerId: string;
  onStart(): void;
}

export function WaitingScreen({ view, playerId, onStart }: WaitingScreenProps) {
  const me = view.players.find((p) => p.id === playerId);
  const isHost = view.hostPlayerId === playerId;
  const connected = view.players.filter((p) => p.connected).length;
  const canStart = isHost && connected >= MIN_PLAYERS;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center gap-4 bg-[radial-gradient(ellipse_at_50%_40%,#0b3a38,#0f0f12_70%)] px-6 text-center">
      <Avatar name={me?.name ?? "?"} avatar={me?.avatar ?? 0} size={96} glow className="animate-pulse-beat" />
      <h1 className="text-3xl font-black leading-tight">Você está dentro!</h1>
      <p className="text-lg font-semibold text-soft">Olhe para a TV</p>
      <Equalizer bars={7} seed={4} className="h-8 w-16" barClassName="bg-cyan" />
      <p className="text-sm font-semibold text-muted">
        Sala {view.code} · {view.players.length} jogador{view.players.length === 1 ? "" : "es"}
      </p>

      {isHost && (
        <Button disabled={!canStart} onClick={onStart} className="mt-4 w-full">
          Iniciar Seleção de Gêneros
        </Button>
      )}
      {isHost && !canStart && <p className="text-xs text-muted">Ativo com {MIN_PLAYERS} ou mais jogadores</p>}
      {!isHost && <p className="text-xs text-muted">Aguardando o anfitrião iniciar…</p>}
    </div>
  );
}
