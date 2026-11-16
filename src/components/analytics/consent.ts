"use client";

import { useSyncExternalStore } from "react";

/** granted/denied = escolha do usuário; pending = ainda não escolheu; unknown = antes da hidratação. */
export type ConsentState = "granted" | "denied" | "pending" | "unknown";

export const CONSENT_KEY = "beatrush-consent";
const EVENT = "beatrush:consent";

// Espelho em memória: se o localStorage estiver bloqueado, a escolha vale ao menos durante a sessão.
let memory: "granted" | "denied" | null = null;

function stored(): "granted" | "denied" | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

export function getConsent(): "granted" | "denied" | null {
  return stored() ?? memory; // o armazenamento manda; a memória só cobre o caso dele estar bloqueado
}

function emit() {
  window.dispatchEvent(new Event(EVENT));
}

export function setConsent(value: "granted" | "denied") {
  memory = value;
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {
    /* sem armazenamento: vale só nesta sessão */
  }
  emit();
}

/** Apaga a escolha: o banner volta a aparecer ("Preferências de privacidade"). */
export function resetConsent() {
  memory = null;
  try {
    localStorage.removeItem(CONSENT_KEY);
  } catch {
    /* idem */
  }
  emit();
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === CONSENT_KEY || e.key === null) cb(); // outra aba mudou
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useConsent(): ConsentState {
  return useSyncExternalStore(
    subscribe,
    () => getConsent() ?? "pending",
    () => "unknown", // no servidor e na hidratação: nada de banner "piscando" para quem já escolheu
  );
}
