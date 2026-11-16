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

## Privacidade (atenção antes de publicar)

O GA usa cookies e identificadores. Em produção para o público do Brasil/UE, a LGPD/GDPR normalmente exige
**aviso e consentimento** antes de carregar o script. Hoje o app **não tem banner de consentimento**: com o ID
definido, o GA carrega para todos. Ver `06-future-work.md` (banner de consentimento) e mencionar o Analytics na
tela "Sobre"/política de privacidade.
