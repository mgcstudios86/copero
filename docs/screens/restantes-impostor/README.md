# Diseño pantallas restantes impostor (MGC-434)

**Proyecto**: copero (mgcstudios/copero)
**Origen**: 8 flow.md mergeados en PR #655 (SHA `8e866e3`) por flow-architect MGC-433
**Alcance**: 24 pantallas mobile portrait (390×844 baseline), dark-first zinc-950 + green-500 CTA
**Artifact primario**: `source/*.html` + `tokens.css` + `responsive.css` + `components.css` (mobile-developer lee esto, no los PNGs)

## Estructura

```
docs/screens/
├── restantes-impostor/source/          # compartido entre todos los flows
│   ├── tokens.css                      # variables CSS del design system copero
│   ├── responsive.css                  # mobile-first, breakpoints 360/390/430
│   ├── components.css                  # primitives: btn, card, chip, modal, bracket, calendar...
│   └── README.md                       # mapeo HTML → componente RN
│
├── temporada-loop-5-semanas-playoffs/source/
│   ├── 01-calendario-semanal.html
│   ├── 02-playoffs-bracket.html
│   └── 03-fin-de-ano.html
│
├── mercado-de-pases/source/
│   ├── 01-lista-jugadores.html
│   ├── 02-detalle-jugador.html
│   └── 03-confirmacion-traspaso.html
│
├── post-match/source/
│   ├── 01-resumen-partido.html
│   ├── 02-eventos-clave.html
│   └── 03-cta-post-match.html
│
├── modo-copero/source/
│   ├── 01-seleccion-copa.html
│   ├── 02-calendario-copa.html
│   └── 03-modal-celebracion.html
│
├── i18n-es-en-pt/source/
│   ├── 01-selector-onboarding.html
│   ├── 02-selector-settings.html
│   └── 03-empty-states.html
│
├── onboarding-fresh-user/source/
│   ├── 01-welcome-carousel.html
│   ├── 02-seleccion-equipo.html
│   └── 03-tutorial-primer-partido.html
│
├── save-load/source/
│   ├── 01-lista-saves.html
│   ├── 02-confirm-overwrite.html
│   └── 03-auto-save-indicator.html
│
└── restart-limpio/source/
    ├── 01-confirm-modal-3-pasos.html
    ├── 02-reset-visual.html
    └── 03-loading-wipe.html
```

## Mapa flow → screens

| Flow | Screens | Path | Handoff |
|------|---------|------|---------|
| 1. Temporada loop + playoffs + fin de año | 3 | `temporada-loop-5-semanas-playoffs/source/` | `docs/handoffs/temporada-loop-5-semanas-playoffs.md` |
| 2. Mercado de pases | 3 | `mercado-de-pases/source/` | `docs/handoffs/mercado-de-pases.md` |
| 3. Post-match | 3 | `post-match/source/` | `docs/handoffs/post-match.md` |
| 4. Modo Copero | 3 | `modo-copero/source/` | `docs/handoffs/modo-copero.md` |
| 5. i18n ES/EN/PT | 3 | `i18n-es-en-pt/source/` | `docs/handoffs/i18n-es-en-pt.md` |
| 6. Onboarding fresh user | 3 | `onboarding-fresh-user/source/` | `docs/handoffs/onboarding-fresh-user.md` |
| 7. Save/Load | 3 | `save-load/source/` | `docs/handoffs/save-load.md` |
| 8. Restart limpio | 3 | `restart-limpio/source/` | `docs/handoffs/restart-limpio.md` |

## Convenciones aplicadas

- **Brand**: tokens copero (`#09090B` bg, `#22C55E` CTA, `#A855F7` accent, `#FFFFFF` fg)
- **Tipografía**: Inter (texto), Poppins (headings), JetBrains Mono (números)
- **Mobile-first**: breakpoints compact 360 / standard 390 / pro max 430
- **Touch targets**: ≥44pt en todo lo interactivo
- **Contraste**: WCAG AA verificado (bg=#09090B, fg=#FAFAFA = 16:1)
- **Safe area iOS**: `env(safe-area-inset-*)` en header/footer
- **Estados**: default + (empty + loading + error) traducidos en i18n flow

## Lo que NO está incluido

- **Lógica de negocio**: stubs en RN, el mobile-developer implementa.
- **Backend**: API endpoints, persistencia.
- **PNGs exportados**: el operador los exporta desde la GUI de OpenDesign (Download → PNG) por device matrix.
- **Accesibilidad AA beyond**: VoiceOver labels incluidos, pero audit completo con screen reader es follow-up.

## Próximo paso

Tickets de validación in_review por operador (uno por flow o consolidado, según decisión) — pendiente respuesta `ok` / `cambiar` / `rechazar` antes de handoff al dev.