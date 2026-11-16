"use client";

import Script from "next/script";
import { useEffect } from "react";
import { useConsent } from "./consent";

/** Remove os cookies do GA (`_ga`, `_ga_*`, `_gid`) do host e dos domínios pai. */
export function clearGaCookies() {
  const parts = location.hostname.split(".");
  const domains = ["", ...parts.map((_, i) => "." + parts.slice(i).join("."))];
  for (const raw of document.cookie.split(";")) {
    const name = raw.split("=")[0].trim();
    if (name !== "_ga" && name !== "_gid" && !name.startsWith("_ga_")) continue;
    for (const d of domains)
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${d ? `; domain=${d}` : ""}`;
  }
}

/**
 * Carrega o GA4 **somente após o consentimento**. Sem aceite (ou ao revogar) o script não é carregado,
 * o envio fica desligado (`ga-disable-<ID>`) e os cookies do GA são apagados.
 */
export function GoogleAnalytics({ id }: { id: string }) {
  const consent = useConsent();
  const granted = consent === "granted";

  useEffect(() => {
    (window as unknown as Record<string, boolean>)[`ga-disable-${id}`] = !granted;
    if (consent === "denied" || consent === "pending") clearGaCookies();
  }, [id, granted, consent]);

  if (!granted) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');`}
      </Script>
    </>
  );
}
