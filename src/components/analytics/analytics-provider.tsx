"use client";

import { createContext, useContext } from "react";
import { ConsentBanner } from "./consent-banner";
import { GoogleAnalytics } from "./google-analytics";

const AnalyticsContext = createContext(false);

/** `true` quando o Analytics está configurado (há ID): habilita o banner e o atalho de privacidade no "Sobre". */
export function useAnalyticsEnabled(): boolean {
  return useContext(AnalyticsContext);
}

/** Sem `gaId` não renderiza banner nem script: o app não menciona Analytics se não o usa. */
export function AnalyticsProvider({ gaId, children }: { gaId: string | null; children: React.ReactNode }) {
  return (
    <AnalyticsContext.Provider value={gaId !== null}>
      {children}
      {gaId && (
        <>
          <GoogleAnalytics id={gaId} />
          <ConsentBanner />
        </>
      )}
    </AnalyticsContext.Provider>
  );
}
