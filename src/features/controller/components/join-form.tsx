"use client";

import { useState } from "react";
import { AVATAR_COLORS, Button } from "@/components/ui";
import { cn } from "@/lib/cn";

export interface JoinData {
  code: string;
  name: string;
  avatar: number;
}

interface JoinFormProps {
  initialCode?: string;
  error?: string | null;
  onSubmit(data: JoinData): void;
}

const LABEL = "text-[11px] font-extrabold tracking-[0.15em] text-muted";

export function JoinForm({ initialCode = "", error, onSubmit }: JoinFormProps) {
  const [code, setCode] = useState(initialCode.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4));
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(1);
  const valid = code.length === 4 && name.trim().length > 0;

  return (
    <form
      className="mx-auto flex min-h-dvh w-full max-w-sm flex-col gap-3.5 px-5 pb-6 pt-10"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit({ code, name: name.trim(), avatar });
      }}
    >
      <h1 className="text-brand text-center text-3xl font-black">BEATRUSH</h1>

      <label className="mt-2 flex flex-col gap-2">
        <span className={LABEL}>CÓDIGO DA SALA</span>
        <input
          name="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))}
          autoCapitalize="characters"
          autoComplete="off"
          inputMode="text"
          maxLength={4}
          placeholder="ABCD"
          className="h-14 rounded-xl border-2 border-line bg-surface px-4 text-center text-3xl font-black tracking-[0.4em] outline-none focus:border-cyan"
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className={LABEL}>SEU NOME</span>
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={16}
          autoComplete="nickname"
          placeholder="Como te chamam?"
          className="h-12 rounded-xl border-2 border-line bg-surface px-4 text-lg font-bold outline-none focus:border-cyan"
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className={LABEL}>AVATAR</legend>
        <div className="mt-2 grid grid-cols-5 gap-2">
          {AVATAR_COLORS.map((color, i) => (
            <button
              key={color}
              type="button"
              aria-label={`Avatar ${i + 1}`}
              aria-pressed={avatar === i}
              onClick={() => setAvatar(i)}
              className={cn("aspect-square rounded-full", avatar === i && "outline-[3px] outline-offset-2 outline-white")}
              style={{ background: color }}
            />
          ))}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="rounded-xl border border-red bg-red/15 px-4 py-3 text-center text-sm font-bold text-red">
          {error}
        </p>
      )}

      <Button type="submit" disabled={!valid} className="mt-auto">
        Entrar no Jogo
      </Button>
    </form>
  );
}
