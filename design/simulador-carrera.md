# Simulador de carrera — spec visual

Wireframes HTML + tokens + copy para handoff a mobile-developer.
Fuente del árbol de decisión: `design/simulador-carrera/tree-arbol-decision.md` (MGC-431).

**Wireframes**: `design/simulador-carrera/screens/01-splash.html` … `10-career-end.html`.
**Tokens**: `src/design/tokens.ts` (paleta `dark`, eje `pitch-*` documentado en componentes).
**Capturas PNG 375×812**: `design/simulador-carrera/evidence/wireframes/`.

## 1. Árbol de pantallas

| # | Pantalla | Wireframe | Trigger entrada | Trigger salida | Estado final |
|---|---|---|---|---|---|
| 1 | SPLASH | `01-splash.html` | Cold start | `Continuar` | jugador + país + modo |
| 2 | NATIONALITY | `02-nationality.html` | `Continuar` desde SPLASH | `Continuar` | país seleccionado (24+ disponibles) |
| 3 | IDENTITY | `03-identity.html` | `Continuar` desde NATIONALITY | `Continuar` | apellido + número + pierna |
| 4 | POSITION | `04-position.html` | `Continuar` desde IDENTITY | `Confirmar identidad` | posición (12 opciones) |
| 5 | DASHBOARD (inicial) | `05-dashboard-initial.html` | `Confirmar identidad` | Selección de club | estado pre-primer-evento |
| 6 | DASHBOARD (carrera) | `06-dashboard-active.html` | Evento resuelto | Siguiente evento / fin | estado entre eventos |
| 7 | OFFER_YOUTH | `07-offer-youth.html` | Edad 16-17, club = "Libre" | Selección de club | asignación club inicial |
| 8 | LOAN_OFFER | `08-loan-offer.html` | Club actual libera al jugador | Selección destino | préstamo activo |
| 9 | RETURN_PARENT | `09-return-parent.html` | Fin de préstamo | Selección destino | nuevo club / préstamo / quedarse |
| 10 | CAREER_END | `10-career-end.html` *(hipotético)* | Edad 35-39 | `Ver logros` | fin de carrera |

## 2. Estados y transiciones

### Estados del jugador

| Variable | Tipo | Rango | Notas |
|---|---|---|---|
| `OVR` | int | 50 → 87 | Crece ~3-5 por temporada si juega |
| `EDAD` | int | 16 → 39 | Carrera potencial de 24 años |
| `VALOR` | string EUR | €100K → €45M | Crece con OVR y trayectoria |
| `CLUB` | string \| "Libre" | dinámico | Cambia por eventos |
| `POS` | enum | 12 valores | Fijado en IDENTITY |
| `FOOT` | enum | Left \| Right | Fijado en IDENTITY |
| `NUM` | int | default 10 | Fijado en IDENTITY |
| `COUNTRY` | string | 24+ | Fijado en NATIONALITY |
| `PJ` | int | 0 → 412+ | Por club/temporada |
| `GLS` | int | 0 → 94+ | Forward / Midfielder |
| `AST` | int | 0 → 12+ | Forward / Midfielder |
| `GR` | int | 0 → 3 | Solo POR |
| `VI` | int | 0 → ? | Solo POR |
| `MODE` | enum | Intensa \| Normal \| Exprés | Fijado en SPLASH |

### Modos y cadencia

| Modo | Cadencia decisión | Eventos totales esperados (~24 años) |
|---|---|---|
| Intensa | 1 por temporada | ~24 |
| Normal | cada 2 temporadas | ~12 |
| Exprés | cada 3 temporadas | ~8 |

### Eventos y transiciones

| Evento | Trigger | Frecuencia | Decisión | Consecuencia |
|---|---|---|---|---|
| Oferta de cantera | edad ~16-17, club = "Libre" | Una vez al inicio | Fichar por uno de 3 clubes | Club inicial asignado |
| Cambio de club / fichaje | según modo | Cada N años | Fichar / Préstamo / Quedarse | OVR + Valor + historial actualizados |
| Salida a préstamo | club actual libera al jugador | Variable | Préstamo en uno de 3 destinos | Club temporal |
| Regreso al club propietario | fin del préstamo | Cada fin de préstamo | Próximo destino | Sigue el ciclo |
| Fin de carrera | edad 35-39 | Una vez | — | Resumen OVR final + logros (HIPOTÉTICO) |

### Patrón de 3 botones (eventos)

Todos los eventos presentan 3 opciones principales en formato vertical:

```
┌──────────────────────────────┐
│ [CREST] Fichar por [Club]    │
│          [Liga]              │
├──────────────────────────────┤
│ [CREST] Préstamo en [Club]   │
│          [Liga]              │
├──────────────────────────────┤
│ [CREST] Quedarse en [Club]   │   (solo RETURN_PARENT)
│          [Liga]              │
└──────────────────────────────┘
```

Cada botón: altura mínima 88px, crest 56×56, label del club + liga, badge con tipo de acción.

## 3. Copy exacta (transcripción literal)

### Splash
- Título: "Construí tu carrera futbolística"
- Subtítulo: "Elegí tu origen, tomá decisiones clave y dejá que el destino te lleve a una trayectoria única de títulos, estadísticas y momentos decisivos."
- Modo: "Intensa" — "1 decisión por temporada, inmersión profunda."
- Modo: "Normal" — "Decisiones cada 2 temporadas, una experiencia equilibrada."
- Modo: "Exprés" — "Decisiones cada 3 temporadas para disfrutarlo rápido."
- CTA primario: "Comenzar carrera"
- CTA secundario: "Volver a Juegos"
- Switcher: "EN" · "ES" · "PT"

### Nacionalidad
- Título: "Nacionalidad"
- Placeholder búsqueda: "Buscar país"
- Botón: "VER MÁS"
- CTAs: "Volver" · "Continuar"
- Lista visible (24): Alemania, Argentina, Bélgica, Bolivia, Brasil, Canadá, Chile, Colombia, Croacia, Ecuador, España, Estados Unidos, Francia, Inglaterra, Italia, México, Países Bajos, Paraguay, Perú, Portugal, Rusia, Turquía, Uruguay, Venezuela

### Identidad
- Título: "Identidad"
- Field 1 label: "APELLIDO" · placeholder: "Apellido"
- Field 2 label: "NÚMERO" · default: 10
- Field 3 label: "PIERNA HÁBIL"
- Opciones pierna: "Izquierda" · "Derecha"
- CTAs: "Volver" · "Continuar"

### Posición
- Título: "Posición"
- Códigos: EI · DC · ED · MI · MCO · MD · LI · MC · LD · MCD · DFC · POR
- Nombres legibles: Extremo Izquierdo · Delantero Centro · Extremo Derecho · Medio Izquierdo · Media Punta Ofensivo · Medio Derecho · Lateral Izquierdo · Medio Centro · Lateral Derecho · Medio Centro Defensivo · Defensa Central · Portero
- CTAs: "Volver" · "Confirmar identidad"

### Dashboard / Eventos
- Stats keys: "OVR" · "EDAD" · "VALOR" · "CLUB" · "PJ" · "GLS" · "AST"
- Stats POR: "GR" · "VI"
- Estados: "Libre" · "Eligiendo club..."
- Tags de evento: "Oferta de cantera" · "Salida a préstamo" · "Regreso a tu club"
- Cuerpo evento cantera: "Tres clubes quieren sumarte a su proyecto juvenil. Elegí dónde..."
- Cuerpo evento préstamo: "Tu club quiere que sumes minutos en otro equipo. Elegí dónde..."
- Cuerpo evento regreso: "Volvés de tu préstamo y tenés que definir tu próximo paso."
- Acciones: "Fichar por [Club] [Liga]" · "Préstamo en [Club] [Liga]" · "Quedarse en [Club]"
- CTA logros: "Ver logros"

## 4. Assets nuevos necesarios

| Asset | Formato | Dónde se usa | Fuente / reemplazo |
|---|---|---|---|
| Flags 24 países | SVG 4×3 (32×24 px) | NATIONALITY grid, header DASHBOARD | `media.copero.com.ar/flags/4x3/{cc}.svg` (referencia). Para nativo: descargar set open-source (flag-icons / flagpack). |
| Crests de clubes (≥30) | SVG o PNG 56×56 px | OFFER_YOUTH, LOAN_OFFER, RETURN_PARENT | Set open-source (Wikipedia / club-crests) o silhouettes genéricos. |
| OG header | JPG 16:9 | SPLASH hero | `media.copero.com.ar/minigames/career-simulator/header2.jpg` (referencia). |
| Iconografía stats | emoji inline | DASHBOARD stats | 🥅 portería · 🧤 guantes (no son archivos, son caracteres Unicode). |
| Achievements icons | emoji inline | CAREER_END | 🏆 ⚽ 🌍 📈 (Unicode). |

### Fonts

- `Space Grotesk` — display (headings, event-tags)
- `DM Sans` — body
- `JetBrains Mono` — números (OVR, VALOR, stats)

Estas tres tipografías ya están declaradas en `src/design/tokens.ts` (`fontFamily.display` / `body` / `mono`). Sin cambios.

## 5. Tokens aplicados

| Token | Valor | Uso |
|---|---|---|
| `palette.dark.bg` | `#0E1411` | Fondo del dispositivo |
| `palette.dark.surface` | `#16201A` | Cards (header dashboard, ofertas) |
| `palette.dark.surface2` | `#1F2A24` | Crests, OG placeholder |
| `palette.dark.text` | `#F0EAE0` | Texto principal |
| `palette.dark.textStrong` | `#FFFFFF` | OVR, headings |
| `palette.dark.textMuted` | `#B8C2BC` | Subtítulos, lede |
| `palette.dark.primary` | `#4FBE82` | CTA primario, modo seleccionado, oferta activa |
| `palette.dark.primarySoft` | `#1B3A2B` | Estado `aria-pressed` ofertas |
| `palette.dark.accent` | `#E96A56` | Event-tag "Salida a préstamo" |
| `palette.dark.focus` | `#93C5FD` | `outline` focus-visible |
| `palette.dark.border` | `#2E3A33` | Bordes 1px |
| `radii.lg` | 12 | Cards y botones |
| `radii.xl` | 16 | OG hero |
| `tapTarget` | 44 | Min height 44-48px (algunos 88px para listas verticales) |
| `spacing.5` | 24 | Padding del dispositivo |
| `spacing.3` | 12 | Gap entre cards |

## 6. Accesibilidad

- `lang="es-AR"` en cada HTML.
- Landmarks: `<main role="main" aria-labelledby="…">` en cada pantalla.
- Cada input / grupo toggle / grid de opciones tiene `<label>` o `aria-label`/`aria-pressed`.
- Estados selected via `aria-pressed` (no solo color).
- `focus-visible` outline 3px `--focus` en todos los interactivos.
- Tap targets mínimo 44px (CTAs 48-52px, opciones 88px).
- Contraste texto principal `#F0EAE0` sobre `#0E1411` ≈ 16:1 (AAA).
- Contraste texto muted `#B8C2BC` sobre `#0E1411` ≈ 9:1 (AAA large + AA normal).
- Contraste primary `#4FBE82` sobre `#0E1411` ≈ 8:1 (AAA).
- No se usa color solo para transmitir información: cada estado tiene texto + ícono o label.

## 7. Diff contra spec anterior (MGC-429)

MGC-429 mockups iniciales (`design/screens/01-splash.html` … `04-result.html`) cubrían otro juego (palabras). Para el simulador-carrera NO existía spec anterior en `design/simulador-carrera/`. Este spec es la primera entrega visual específica del simulador.

Lo que se ELIMINÓ de planes sueltos:

- Mockup único "Splash carrera" propuesto por dev sin device frame → reemplazado por 01-splash.html con device 375×812, OG placeholder, selector de modo con 3 opciones presionables.
- Lista de países sin búsqueda → reemplazado por 02-nationality.html con search + grid 3 cols + botón VER MÁS.
- Placeholder genérico "selecciona posición" → reemplazado por 04-position.html con 12 posiciones nombradas (no solo códigos).
- Dashboard "futurista" especulativo → reemplazado por 05/06-dashboard-*.html con stats reales observadas (OVR/EDAD/VALOR + historial tabular).
- Eventos genéricos "Decide A/B/C" → reemplazados por 07/08/09-*.html con tipos de acción diferenciados (Fichar / Préstamo / Quedarse) y crest visible.

Lo que se AÑADIÓ:

- Pantalla CAREER_END (hipotético) con ribbon explícito de "HIPOTÉTICO — sin captura observada".
- Línea de tiempo 16→39 con dots clicables.
- Modo selector en SPLASH con cadencia documentada.
- Stats específicas POR (GR + VI) en variante futura.

## 8. Handoff a mobile-developer (MGC-433)

Componentes nuevos / actualizados requeridos: ver `design/components.md`.

Contratos a respetar (no romper):

- `tokens.ts` paleta `dark` + escalas (`primary` / `accent` / `border` / `text`).
- `fontFamily` (display / body / mono).
- `radii.lg` (12) y `radii.xl` (16).
- `tapTarget` (44) en todos los Pressable.
- C2 / MGC-297 (componentes Pressable accesibles): cada interactivo debe mantener `accessibilityRole` + `accessibilityLabel` + `accessibilityState`.

Evidencia a entregar en MGC-433: implementación en `src/screens/simulador-carrera/`, snapshots Jest, y capturas en device real (iOS + Android) vía MGC-419.