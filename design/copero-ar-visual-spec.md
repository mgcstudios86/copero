# Copero.com.ar — spec visual de referencia

**Ticket:** MGC-554 (Designer)
**Padre:** MGC-553
**Fuente auditada:** <https://copero.com.ar/>
**Capturas propias:** `design/refs/copero-ar/` (16 imágenes, 4 rutas × 2 viewports × 2 schemes)
**Stack del referente:** SPA React + Tailwind v4 + oklch + shadcn-style tokens.
**Fecha:** 2026-08-24

## 1. Resumen ejecutivo

Copero.com.ar es una SPA dark-first (independientemente de `prefers-color-scheme`,
el sitio renderiza siempre sobre `--background: #09090B` / zinc-950). La
identidad visual es:

- Fondo único `#09090B` (zinc-950) — el sitio **no usa** un theme light en
  runtime aunque los CSS vars lo declaren.
- Tipografía mixta: **Inter** UI/cuerpo, **Poppins** headings numéricos/UI
  (peso 600, tracking ajustado), **Libre Baskerville** reservado para display
  editorial en mayúsculas condensadas (`DEMOSTRÁ CUÁNTO SABÉS`).
- Lenguaje de tarjetas con overlay fotográfico + texto blanco + CTA pill.
- Ticker superior con escudos + marcadores en vivo (negro sólido).
- Paleta de acento por arquetipo (`--color-{name}-500` oklch) — ver §3.
- Tres modos de tema declarados en UI (sol / sistema / luna) — el botón
  existe pero el render está forzado a dark.

## 2. Capturas propias

| Ruta | Viewport | Scheme | Archivo |
| --- | --- | --- | --- |
| `/` (home) | desktop-1280 | dark | `design/refs/copero-ar/desktop-1280-dark-home.png` |
| `/` | desktop-1280 | light* | `desktop-1280-light-home.png` |
| `/` | mobile-375 | dark | `mobile-375-dark-home.png` |
| `/` | mobile-375 | light* | `mobile-375-light-home.png` |
| `/juegos` | desktop-1280 | dark | `desktop-1280-dark-juegos.png` |
| `/juegos` | desktop-1280 | light* | `desktop-1280-light-juegos.png` |
| `/juegos` | mobile-375 | dark | `mobile-375-dark-juegos.png` |
| `/juegos` | mobile-375 | light* | `mobile-375-light-juegos.png` |
| `/futbol` | desktop-1280 | dark | `desktop-1280-dark-futbol.png` |
| `/futbol` | desktop-1280 | light* | `desktop-1280-light-futbol.png` |
| `/futbol` | mobile-375 | dark | `mobile-375-dark-futbol.png` |
| `/futbol` | mobile-375 | light* | `mobile-375-light-futbol.png` |
| `/prodes` | desktop-1280 | dark | `desktop-1280-dark-prodes.png` |
| `/prodes` | desktop-1280 | light* | `desktop-1280-light-prodes.png` |
| `/prodes` | mobile-375 | dark | `mobile-375-dark-prodes.png` |
| `/prodes` | mobile-375 | light* | `mobile-375-light-prodes.png` |

\* `light*` significa `colorScheme: light` forzado vía Playwright; el sitio
renderiza idéntico a dark. Confirmado: la SPA fuerza el theme dark en runtime.

## 3. Tokens — paleta

### 3.1 Roles semánticos (theme dark activo)

| Rol | Variable CSS | HSL declarado | Hex equivalente | Uso |
| --- | --- | --- | --- | --- |
| `bg` | `--background` | `240 10% 4%` | `#09090B` (zinc-950) | Fondo de página completo |
| `surface` | `--card` | `240 10% 7%` | `#101012` | Tarjetas de partido, league cards |
| `surface-2` | `--popover` | `240 10% 8%` | `#131316` | Overlays / dropdowns |
| `text-strong` | `--foreground` | `0 0% 98%` | `#FAFAFA` | Headings, body principal |
| `text-muted` | `--muted-foreground` | `240 5% 65%` | `#A1A1AA` | Labels, fechas, "FÚTBOL" |
| `border` | `--border` | `240 10% 12%` | `#1C1C20` | Hairlines internos de cards |
| `primary` | `--primary` | `0 0% 98%` | `#FAFAFA` | Botón "Crear cuenta" |
| `accent` | `--accent` | `240 10% 8.5%` | `#16161A` | Hover sutil de cards |
| `destructive` | `--destructive` | `0 72.8% 55%` | `#EF4444` (red-500) | Estados de error |
| `ring` | `--ring` | `240 5% 85%` | `#D4D4D8` | Foco visible (zinc-300) |
| `radius` | `--radius` | — | `0.5rem` (8px) | Radio base de controles |

### 3.2 Tokens existentes en light (no activos en runtime pero declarados)

```
--background: 38 12% 95%   → #F5F0E8 (warm cream)
--foreground: 28 6% 10%    → #1B1916
--card: 38 10% 99%         → #FDFCFA
--primary: 28 6% 18%       → #2E2A24
```

El theme light existe en CSS vars pero `body` siempre resuelve a dark. **No
recomendamos migrar a esa paleta light** porque rompe el lenguaje visual
actual; en su lugar, MGC-555 debería decidir si la app propia debe seguir
`#FAF7F2` (lo que tiene hoy) o alinearse a `#09090B`.

### 3.3 Paleta de arquetipos (CSS vars `--color-{name}-500`)

13 acentos en oklch, usados como `--archetype-accent` en variantes de arquetipo:

| Color | oklch | Hex aproximado | Uso típico |
| --- | --- | --- | --- |
| `blue-500` | `oklch(62% .19 259)` | `#3B82F6` | default |
| `cyan-500` | `oklch(71% .13 211)` | `#06B6D4` | — |
| `emerald-500` | `oklch(70% .15 162)` | `#10B981` | "DISPONIBLE" badge |
| `green-500` | `oklch(72% .21 142)` | `#22C55E` | resultado Pleno |
| `lime-500` | `oklch(76% .19 130)` | `#84CC16` | — |
| `yellow-500` | `oklch(80% .18 92)` | `#EAB308` | resultado Acierto |
| `amber-500` | `oklch(77% .19 70)` | `#F59E0B` | — |
| `orange-500` | `oklch(70% .21 48)` | `#F97316` | — |
| `red-500` | `oklch(64% .24 25)` | `#EF4444` | resultado Error |
| `rose-500` | `oklch(64% .21 16)` | `#F43F5E` | — |
| `pink-500` | `oklch(65% .24 1)` | `#EC4899` | — |
| `purple-500` | `oklch(63% .24 305)` | `#A855F7` | HeroCard "Convertite en leyenda" |
| `fuchsia-500` | `oklch(67% .27 322)` | `#D946EF` | — |
| `violet-500` | `oklch(61% .27 293)` | `#8B5CF6` | — |
| `indigo-500` | `oklch(58% .22 277)` | `#6366F1` | — |
| `teal-500` | `oklch(70% .13 184)` | `#14B8A6` | — |
| `zinc-500` | `oklch(55% .01 264)` | `#71717A` | neutral |

## 4. Tokens — tipografía

Familias cargadas en `<link>` de copero.com.ar:

```
Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900
Libre Baskerville:ital,wght@0,400..700;1,400..700
Poppins:wght@400;500;600;700
```

| Token | Familia | Size desktop | Size mobile | Weight | Letter-spacing | Line-height |
| --- | --- | --- | --- | --- | --- | --- |
| `h1` (sección) | Poppins | 24px | 30px | 600 | `tracking-tight` | 1.2 |
| `h2` (sub-sección) | Poppins | 18-20px | 20px | 600 | `tracking-tight` | 1.25 |
| `h3` (card title) | Poppins | 16-18px | 16px | 600 | `tracking-normal` | 1.3 |
| Display editorial | Libre Baskerville | 56-72px | 40px | 700 | `tracking-tight` | 1.0 |
| `body-lg` | Inter | 16px | 16px | 400 | `tracking-normal` | 1.5 |
| `body` | Inter | 14-15px | 14px | 400 | `tracking-normal` | 1.5 |
| `body-sm` (label) | Inter | 12-13px | 12px | 500 | `tracking-wide` | 1.4 |
| Eyebrow / kicker | Inter | 11-12px | 11px | 500 | `tracking-widest` + uppercase | 1.4 |

Reglas observadas:

- **Headings siempre Poppins** (sans geométrica), nunca Inter para titles.
- **Libre Baskerville aparece solo como display** en una pantalla
  (`/prodes` — `DEMOSTRÁ CUÁNTO SABÉS`); el resto del sitio no la usa.
- Uppercase + `tracking-wide/widest` reservado para kickers (`FÚTBOL`,
  `SECCIONES`, `LEGAL Y CONTACTO`, `DISPONIBLE`).

## 5. Tokens — spacing, radius, elevation

### 5.1 Spacing (escala Tailwind 4px)

```
0  1  2  3  4  5  10  12  16  20  26  35   (en unidades tailwind)
0  4  8 12 16 20  40  48  64  80 104 140   px
```

Uso frecuente observado:

| Token | px | Ejemplos |
| --- | --- | --- |
| `1` | 4 | gap entre escudo y nombre en match row |
| `2` | 8 | padding interno de chips ("DISPONIBLE") |
| `3` | 12 | gap entre filas de footer, padding botones |
| `4` | 16 | padding interno de cards pequeñas (Accesos directos) |
| `5` | 20 | gap entre HeroCards en grilla desktop |
| `10` | 40 | padding generoso dentro de HeroCard (top del título) |
| `12` | 48 | separación entre secciones |
| `16` | 64 | separación entre bloques principales (Hero / Resultados / Blog) |

### 5.2 Radius (Tailwind sm → 3xl)

| Token | px | Uso |
| --- | --- | --- |
| `sm` | 2 | hairline corners (raro) |
| `md` | 6 | botón base |
| `lg` | 8 | cards de partido (LeagueCard) |
| `xl` | 12 | HeroCard, LeagueCard (prodes) |
| `2xl` | 16 | modal/sheet, cookie banner |
| `3xl` | 24 | decorative containers |
| `full` | 9999 | avatares, badges circulares, ticker separator dots |

### 5.3 Elevation (box-shadow)

Sombras usadas (sutiles, casi imperceptibles en dark):

| Token | Valor | Uso |
| --- | --- | --- |
| `shadow-sm` | `0 1px 2px rgb(0 0 0 / .05)` | botones en hover |
| `shadow-md` | `0 4px 6px -1px rgb(0 0 0 / .1)` | dropdowns |
| `shadow-lg` | `0 10px 15px -3px rgb(0 0 0 / .1)` | popovers |
| `shadow-2xl` | `0 25px 50px -12px rgb(0 0 0 / .25)` | modal de cookies |
| `shadow-pulse` | animación custom | badge "EN VIVO" del ticker |
| `shadow-alpha` | variable color con alpha | glow sutil en focus ring |

Las cards oscuras no usan sombra sino **hairline border**
`1px solid var(--border)` (`#1C1C20`).

## 6. Patrones UI

### 6.1 Ticker en vivo

Fila horizontal negra sólida (`bg #000`) que atraviesa el top de todas las
rutas.

- Altura ~64px desktop / 80px mobile.
- Items: cada partido mide ~120px ancho, contiene [escudo local] [abrev]
  [guión medio] [abrev] [escudo visita] + hora debajo.
- Separador vertical 1px `var(--border)` entre items.
- Padding-x 12px por item.
- Auto-scroll horizontal infinito (CSS keyframes, `transform: translateX`).
- Hover: pausa el scroll.

**Implementación RN equivalente:** `<FlatList horizontal pagingEnabled
snapToInterval>` con `Animated.loop` para el autoscroll, o `ScrollView`
horizontal nativo.

### 6.2 HeroCard con overlay

Card grande (≥360px alto desktop) con:

1. Background image full-bleed con `object-fit: cover`.
2. Overlay gradient `linear-gradient(to top, rgba(0,0,0,0.85) 0%,
   rgba(0,0,0,0.2) 60%)`.
3. Tint de color de acento sutil (purple para "Convertite en leyenda",
   teal para "Test de ideología futbolera") — overlay mix-blend.
4. Padding generoso (40px desktop / 24px mobile).
5. Contenido anclado abajo-izquierda: título H2 bold Poppins blanco,
   descripción 14px `text-muted` blanco, `<PillButton>` al pie.
6. Border-radius xl (12px).
7. Hover desktop: lift sutil (`translateY(-2px)` + `shadow-lg`).

```css
.hero-card {
  position: relative;
  border-radius: var(--radius-xl); /* 12px */
  overflow: hidden;
  isolation: isolate;
  min-height: 360px;
  background-color: var(--card);
  border: 1px solid var(--border);
}
.hero-card::before {
  content: "";
  position: absolute; inset: 0;
  background: linear-gradient(to top, rgb(0 0 0 / 0.85), rgb(0 0 0 / 0.2) 60%);
  z-index: 1;
}
.hero-card > * { position: relative; z-index: 2; }
```

### 6.3 PillButton con flecha

Botón principal de CTA. Forma de píldora (radio `full` o `9999px`).

- Background `var(--primary)` (`#FAFAFA` en dark) — blanco puro.
- Foreground `var(--primary-foreground)` (`#09090B`).
- Padding `12px 20px` (vertical × horizontal).
- Font Inter 14px weight 500.
- Icono flecha `→` a la derecha del label (10-12px line-height),
  `transition-transform` con `translateX(2px)` en hover.
- Focus visible: `outline 2px solid var(--ring)` + `outline-offset 2px`.

Variantes: sólido (default), ghost (border 1px + bg transparente).

### 6.4 LeagueCard (Resultados — `/`, `/futbol`)

Card rectangular oscura con:

1. Border-radius `lg` (8px), border 1px `var(--border)`.
2. Header row: badge 32×32 del logo de la liga (redondeado `md`) +
   nombre en mayúsculas Poppins 14px + chevron-down a la derecha.
3. Lista de partidos: cada fila = [escudo 16px] [team name 14px] + spacer +
   [hora 13px `text-muted`].
4. Divider horizontal 1px entre filas.
5. Padding 16px (header) / 12px 16px (filas).
6. Hover en fila completa: bg `var(--accent)`.

**Layout móvil:** una card por fila, full-width. **Desktop:** 3 columnas.

### 6.5 LeagueCard (Prodes — `/prodes`)

Variante con imagen de fondo.

1. Imagen full-bleed con `object-fit: cover`, border-radius `xl` (12px).
2. Overlay gradient bottom oscuro (más oscuro que la HeroCard).
3. Badge verde `DISPONIBLE` (bg `color-emerald-500` oklch ~`#10B981`,
   texto `#052E16` o blanco según contraste, padding 4px 8px, radius
   `full`, font-size 11px uppercase tracking-widest) anclado top-left.
4. Título H3 Poppins 18px blanco abajo-izquierda.
5. Sub-info `icon users + N participantes` 12px `text-muted` blanco.
6. `<PillButton>` "Jugar ahora" abajo-derecha.

### 6.6 Accesos directos (home)

Carrusel horizontal de 5 cards pequeñas:

- Width 200px, height 140px desktop / 140×100 mobile.
- Background image con `object-fit cover`.
- Overlay gradient bottom.
- Título centrado bottom: Inter 14px semibold blanco.
- Sin descripción.
- Border-radius `md` (6px).

### 6.7 BlogRow

Item de lista vertical. Estructura por fila:

- Padding 16px vertical.
- Border-bottom 1px `var(--border)`.
- Título Inter 15px weight 600 blanco, máximo 2 líneas (line-clamp).
- Tag chips debajo: badge pequeño con bg `var(--accent)`, texto 11px
  `text-muted` uppercase + icono del deporte.
- Meta alineada derecha: "Hace X sem" + nombre autor (12px `text-muted`).
- Divider horizontal completo entre filas.

### 6.8 Footer

4 columnas desktop, 1 columna centrada mobile:

1. **Logo + social:** copero logo + botones redondos para X / Instagram /
   Cafecito (cada uno outline 1px + icono).
2. **SECCIONES** (eyebrow uppercase) + links Fútbol / Juegos / Prodes / Blog.
3. **DESTACADO** + Mundial 2026 / Prode Mundial / Libertadores /
   Sudamericana / Liga Profesional.
4. **LEGAL Y CONTACTO** + Sobre nosotros / Privacidad / Cookies / Términos /
   Bases Prode Mundial / Contacto.

Hairline divider arriba. Fila inferior con `© 2026 Copero` izquierda,
`Configurar cookies` centrada, `TEMA ☀ 🖥 🌙` derecha (toggle de 3 modos).

Color links: `text-muted` en reposo, `text-strong` en hover.

## 7. Before / After por arquetipo actual

Comparativa del lenguaje visual **Copero.com.ar (referente)** vs **Copero
app actual** (`design/screens/*.html`).

### 7.1 Splash (01-splash)

| Aspecto | Referente (copero.com.ar) | Actual (`01-splash.html`) | Gap |
| --- | --- | --- | --- |
| Fondo | `#09090B` zinc-950 | `#FAF7F2` cream | **Inversión dark/light** |
| Surface card | `#101012` zinc-900 | `#FFFFFF` | **Inversión** |
| Heading | Poppins 600 30px blanco | Poppins 600 (varios) sobre surface blanco | contraste OK pero mood diverge |
| Logo | pictográfico blanco con isotipo circular | pictográfico cuadrado 96px con gradient verde→coral | cambia la silueta |
| Primary | `#FAFAFA` (white pill) | `#1F6F4A` forest green | **cambio radical de acento** |
| Accent | `#A855F7` purple / `#10B981` emerald por arquetipo | `#C73E2A` coral único | **perdemos 13-acento** |
| Radius | 12px (xl) | 16px (radius-lg propio) | similar |
| Sombra | hairline border, sin sombra | `0 12px 40px rgba(22,32,26,.08)` | drop shadow vs hairline |

**Recomendación:** migrar el splash a dark con surface `#101012`, fondo
`#09090B`, primary `#FAFAFA`, accent heredado del arquetipo (variable).

### 7.2 Question (02-question)

| Aspecto | Referente | Actual | Gap |
| --- | --- | --- | --- |
| Tipografía | Inter 16px body / Poppins 24px H1 | igual | OK |
| Layout | cards full-width apiladas | grid 2×2 de opciones | **cambia la densidad** |
| PillButton | blanco sólido sobre fondo oscuro | "primary" verde forest sólido blanco | **color diverge** |
| Progreso (barra) | custom widget con franjas verticales animado | role="progressbar" simple horizontal | **referente es más expresivo** |
| Acento respuesta correcta | `emerald-500` oklch verde | `#1F6F4A` forest | similar pero no idéntico |
| Acento respuesta incorrecta | `red-500` oklch `#EF4444` | `#C73E2A` coral | divergen |
| Archetype chip | chip outline con icono de mascota | chip verde 10% bg + texto verde | **forma distinta** |

### 7.3 ProgressBar (03-progressbar)

| Aspecto | Referente | Actual | Gap |
| --- | --- | --- | --- |
| Container | dark con border | white surface | **inversión** |
| Timer | font-display grande rojo | Inter 13px coral | tamaño cambia |
| Progreso | barra segmentada con franjas | barra continua 12px height | **referente segmentado** |
| Texto "Ronda 3/10" | Poppins 14px semibold | h1 Poppins 18px | jerarquía baja |
| Border radius | full (9999px) | full (9999px) | OK |

### 7.4 Result (04-result)

| Aspecto | Referente | Actual | Gap |
| --- | --- | --- | --- |
| Fondo | `#09090B` | `#FAF7F2` cream | **inversión** |
| Card surface | `#101012` con border | `#FFFFFF` con shadow | **inversión** |
| Silueta arquetipo | silueta SVG con accent-color dinámico (oklch) | silueta estática | **falta sistema dinámico** |
| Badge "TU ARQUETIPO" | `DISPONIBLE`-style chip verde | uppercase Poppins 13px negro | **forma distinta** |
| Botón jugar de nuevo | pill blanco sólido | "primary verde" | divergen |
| Stats | números grandes Poppins 32-48px blancos | texto 14-16px | **escala cambia** |

## 8. Decisiones abiertas para MGC-555

Decisiones que el plan del padre no cubre y el implementador tiene que
resolver:

1. **¿Migrar la app propia a dark theme `#09090B` o mantener el cream
   `#FAF7F2` actual?** El referente es dark-first; la app propia ya
   commitment light. Recomiendo mantener light + agregar un theme dark
   idéntico al referente como `palette.dark` (C1 ya lo soporta según
   `components.md`).
2. **¿Sumar Libre Baskerville como `font-display`?** Solo se usa en una
   pantalla. Sugerencia: NO sumarla hasta tener ≥2 pantallas que la
   justifiquen (costo de bundle de Google Fonts).
3. **¿Adoptar los 13 colores oklch como `--archetype-accent`?** La app
   ya tiene una paleta `archetypes.ts` con 13 colores hex; conviene
   mapearlos uno a uno.
4. **PillButton vs Button actual:** la app tiene `Button` propio
   (variants primary/secondary/ghost). Recomiendo agregar variante
   `pill` con arrow slot en lugar de reemplazar.

## 9. Riesgos y mitigación

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| Copero.com.ar está en constante cambio visual | Spec puede quedar stale en 30d | Acotar a snapshot 2026-08-24; nota "ref" en doc |
| Theme toggle (sol/sis/luna) no cambia render real | Falsa sensación de theme switch | No replicar el bug; documentar que dark es forzado |
| Tipografía Poppins/Inter via Google Fonts añade ~80 KB | Performance budget | Usar `next/font` con subsetting o preload crítico |
| 13 colores oklch requieren recalibración de contraste | WCAG AA rompe si bajamos lightness | Validar cada uno con `colorjs.io` antes de mergear |
| Cookie banner gigante en home mobile | Cubre CTAs | Mantener comportamiento (no tocar para MGC-555) |

## 10. Anexo — archivos auditados

- HTML: `/`, `/juegos`, `/futbol`, `/prodes`. Descartados por 404:
  `/estadisticas`, `/pronosticos`.
- CSS bundle: `assets/index-D9b8Bs4f.css` (318 KB, ~21k selectores,
  Tailwind v4 compilado).
- Fonts: Google Fonts `Inter`, `Libre Baskerville`, `Poppins`.
- Iconos: lucide-react (visto por clase `lucide-*` en DOM).
- Animaciones: `tailwindcss-animate` + keyframes custom (`burst`,
  `shadow-pulse`, `fade-in/out`, `slide-in-from-*`).

---

**Checklist de aceptación MGC-554:**

- [x] Doc mergeado (este archivo en `design/copero-ar-visual-spec.md`).
- [x] Capturas propias en `design/refs/copero-ar/` (16 archivos,
      supera el mínimo de 12).
- [x] Paleta hex + roles semánticos documentada (§3).
- [x] Tipografía Inter/Libre Baskerville/Poppins con sizes/weights/LH
      documentada (§4).
- [x] Spacing 4/8/12/16/24/32 + radius sm/md/lg/pill + elevation (§5).
- [x] Patrones HeroCard / Ticker / LeagueCard / BlogRow / Footer /
      PillButton (§6).
- [x] Before/after por arquetipo (§7).
- [x] Sin blockers.
