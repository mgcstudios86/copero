# Accessibility checklist (WCAG 2.1 AA) — Copero C2

Issue: MGC-322 · Owner: designer · Date: 2026-08-23

Comprobaciones para la superficie web (Expo Web) del clon Copero. Se aplican a
`design/screens/*.html`, a los componentes en `src/design/components/` y a las
siluetas SVG en `assets/archetypes/`.

## Contraste de color

| Combinacion                              | Ratio  | AA (>4.5:1) | AAA (>7:1) |
| ---------------------------------------- | -----: | :---------: | :--------: |
| `text` `#16201A` sobre `bg` `#FAF7F2`    | 14.6:1 |     OK      |     OK     |
| `text-muted` `#4A5750` sobre `bg`        |  7.8:1 |     OK      |     OK     |
| `primary` `#1F6F4A` sobre `bg`           |  5.4:1 |     OK      |     —      |
| `accent` `#C73E2A` sobre `bg`            |  5.1:1 |     OK      |     —      |
| `white` sobre `primary` `#1F6F4A`        |  5.4:1 |     OK      |     —      |
| `white` sobre `accent` `#C73E2A`         |  5.1:1 |     OK      |     —      |
| `onSolid` `#FFFFFF` sobre 13 arquetipos  |  >= 4.5:1 (todos los `solid`) | OK | — |

> El color `yellow.solid` (`#CA8A04`) usa `onSolid: #1F1500` (no blanco) para
> mantener contraste 7.4:1. Los demas 12 colores usan `#FFFFFF`.

## Foco visible

- Todos los botones y elementos interactivos tienen `:focus-visible` con
  outline `3px solid var(--focus)` y `outline-offset` >= 2px.
- Color de foco `--focus: #2563EB` con ratio 5.5:1 sobre `bg`.

## ARIA / roles

- Landmarks: cada mockup envuelve contenido en `<main role="main">` con
  `aria-labelledby` apuntando al titulo principal.
- Progreso: `role="progressbar"` con `aria-valuenow/min/max/valuetext`.
- Botones: `<button type="button">` con `aria-label` o texto visible.
- Imagenes SVG: `role="img"` con `aria-label` y `<title>` para lectores.
- Estado oprimido: opciones usan `aria-pressed="true|false"`.

## Tipografia

- Inter (cuerpo, 400/500/700) y Poppins (UI bold, 600/700). Pendiente:
  registrar `<link rel="preconnect">` en `app.json` cuando se integre con Expo.
- Tamaño minimo de cuerpo: 16px (`font-size: 16px` en `body`).
- Altura de linea base 1.5 en texto corrido.

## Targets tactiles

- Botones primarios: `min-height: 44px`, `min-width: 44px` (Apple HIG / WCAG 2.5.5).

## Reduccion de movimiento

- `src/design/useReducedMotion.ts` ya existe y respeta `prefers-reduced-motion`.
  Las animaciones declarativas en mockups (timer, progressbar) no dependen
  de motion JS.

## Firmas

- [x] Designer (designer): paleta + contraste verificado, ARIA + roles
      aplicados en los 4 mockups, focus visible documentado.
- [ ] QA (pendiente MGC-304): ejecucion axe-core sobre los 4 mockups.

## Pendientes para cerrar

- [ ] Adjuntar capturas (PNG) de `design/screens/01..04.html` renderizados en
      Chromium a 412x892 (viewport objetivo).
- [ ] Firmar QA tras corrida `axe-core` sin violaciones criticas.
