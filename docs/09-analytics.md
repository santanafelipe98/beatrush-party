# Google Analytics (opcional)

O app carrega o **Google Analytics 4** só se a variável de ambiente `GA_MEASUREMENT_ID` estiver definida
com um ID de medição válido (`G-XXXXXXXXXX`). Sem ela, nenhum script do Google é carregado.

## Decisões

| Decisão | Motivo |
| --- | --- |
| Variável **sem** `NEXT_PUBLIC_` | É lida no servidor a cada requisição (o layout é dinâmico por causa do idioma). Trocar o ID em produção **não exige novo build**, bom para uma imagem/deploy único em vários ambientes. |
| ID **validado** (`/^G-[A-Z0-9]{4,20}$/`) | O valor entra num script inline; só o formato do GA4 é aceito. Valor vazio, malformado ou com tentativa de injeção desliga o Analytics em vez de ser interpolado. |
| `next/script` com `afterInteractive` | Não bloqueia a renderização nem a conexão WebSocket do jogo. |
| Implementação própria (sem `@next/third-parties`) | São ~20 linhas; evita dependência extra. |

## Uso

```
GA_MEASUREMENT_ID=G-XXXXXXXXXX npm start
```

Código: `src/components/analytics/google-analytics.tsx` (`parseGaId`, `GoogleAnalytics`), montado em `src/app/layout.tsx`.
Testes: `google-analytics.test.tsx`.

## Consentimento (LGPD/GDPR)

O GA **só é carregado depois do aceite**. Na primeira visita aparece um banner (TV e celular) com **Aceitar** e
**Recusar** com o mesmo destaque; até a escolha, nenhum script nem requisição ao Google acontece.

| Situação | Comportamento |
| --- | --- |
| Sem `GA_MEASUREMENT_ID` | nenhum banner, script ou menção a Analytics (nem no "Sobre") |
| Primeira visita | banner; GA desligado (`ga-disable-<ID>` = true) |
| Aceitar | carrega `gtag.js`; escolha guardada em `localStorage` (`beatrush-consent`) |
| Recusar | nada carrega; cookies `_ga`, `_ga_*`, `_gid` são apagados; o banner não volta |
| Mudar de ideia | "Sobre" → **Preferências de privacidade** apaga a escolha e reabre o banner; ao recusar, o envio é desligado e os cookies apagados |
| `localStorage` bloqueado | a escolha vale na sessão (espelho em memória); nada quebra |

Detalhes de implementação:
- `consent.ts`: store externo (`useSyncExternalStore`), sincroniza abas via evento `storage`. No servidor/hidratação o estado é
  `unknown` e **nada é renderizado**, então quem já escolheu não vê o banner "piscar".
- `consent-banner.tsx`: fixo acima do rodapé da TV; **reserva o espaço no fim da página** (`padding-bottom` no body) para que, no
  celular pequeno, o conteúdo (ex.: "Entrar no Jogo") possa rolar para cima dele em vez de ficar coberto.
- `google-analytics.tsx`: só monta os `<Script>` com consentimento `granted`.
- Textos em pt-BR/en/es.

Limites: o consentimento fica **por navegador** (não por conta). Um script já carregado não é descarregado ao revogar:
a página passa a não enviar mais dados (`ga-disable`) e, na próxima visita, o script nem carrega.
Não é aconselhamento jurídico: revise o texto e a política de privacidade antes de publicar.

Testes: `consent.test.tsx` (unidade), `e2e/analytics.spec.ts` via `npm run test:e2e:analytics` (liga o GA com um ID fictício e
intercepta as requisições ao Google).
