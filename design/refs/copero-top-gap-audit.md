# MGC-646 — Auditoría de gap visual: `copero.top` vs `copero.mgcstudios.app`

**Fecha:** 2026-08-24
**Autor:** Designer (e4f6f15e)
**Estado:** Borrador para review (CTO + Designer)
**Ticket:** MGC-646 · MGC-641 (parent)

---

## 1. Resumen ejecutivo

`copero.top` — el dominio de referencia citado por el operador en MGC-641 — **ya no sirve el sitio original**. La URL redirige hoy a redes de ads (AliExpress en desktop, morningestone.com en mobile). El Wayback Machine no tiene snapshots del sitio original. Por lo tanto, la única fuente de verdad viva es el repo **`github.com/kiya0908/copero`** (rama `main`, actualizado 2026-08-20), que el operador también enlazó en MGC-641.

La auditoría compara el bundle desplegado en `copero.mgcstudios.app` contra ese repo de referencia. Resultado: **el bundle actual conserva identidad visual (eyebrow, hero card con camiseta, CTA verde, "Cómo se juega", FAQ) pero le falta el patrón "starter" completo en el home** — la diferencia funcional más grande es que la versión de referencia expone un formulario de identidad (apellido, dorsal, pierna hábil, nacionalidad, posición, modo de draft Classic/Purist) directamente en la home, mientras nuestro bundle lo deriva a una pantalla aparte (`/simulador-carrera/identity`).

---

## 2. Metodología

### 2.1 Capturas

Playwright headless (system Google Chrome) en runner local. Cuatro capturas por sitio × 2 sitios = **8 capturas totales**:

| Sitio | Viewport | Modo |
| --- | --- | --- |
| `copero.top` | 1440×900 | desktop |
| `copero.top` | 390×844 (iPhone 14, dsf 3) | mobile |
| `copero.mgcstudios.app` | 1440×900 | desktop |
| `copero.mgcstudios.app` | 390×844 (iPhone 14, dsf 3) | mobile |

Cada vista = screenshot full-page + screenshot above-the-fold + dump de DOM (nav, headings, buttons, inputs, sections, footer, lang switcher, eyebrow/chips, sample de body text).

Archivos en `design/refs/copero-top-gap-audit/`:

```
captures/
├── copero-mgc-desktop-1440-fold.png
├── copero-mgc-desktop-1440-full.png
├── copero-mgc-mobile-390-fold.png
├── copero-mgc-mobile-390-full.png
├── copero-top-desktop-1440-fold.png    ← redirect a AliExpress
├── copero-top-desktop-1440-full.png    ← redirect a AliExpress
├── copero-top-mobile-390-fold.png      ← redirect a morningestone.com
└── copero-top-mobile-390-full.png      ← redirect a morningestone.com
dom/
├── copero-mgc-desktop-1440.json
├── copero-mgc-mobile-390.json
├── copero-top-desktop-1440.json        ← payload de AliExpress
├── copero-top-mobile-390.json          ← payload de morningestone.com
└── _index.json
```

### 2.2 Hallazgo crítico sobre `copero.top`

| Viewport | URL efectiva tras `goto` | Title | Notas |
| --- | --- | --- | --- |
| desktop 1440 | `https://www.aliexpress.com/p/popular-landing/aliexpress.html?_immersiveMode=true&...` | (vacío) | Spam redirect |
| mobile 390 | `https://ne5.morningestone.com/?key=dcec09c5...` | `Cleaner App Update` | Spam redirect |

Wayback Machine API para `copero.top`, `www.copero.top`, `http://copero.top` devuelve `archived_snapshots: {}` — sin capturas. El dominio fue adquirido por terceros.

> **Conclusión metodológica:** las capturas de `copero.top` son evidencia del hijack, no del referente. La comparación se hace contra `github.com/kiya0908/copero` (clonado en `scratch/kiya-copero/`, sólo lectura, no se commitea).

---

## 3. DOM diff por sección

### 3.1 Header / nav top

| Elemento | kiya (referencia) | `copero.mgcstudios.app` |
| --- | --- | --- |
| `<header class="site-header">` | sí | **no** (SafeAreaView sin nav) |
| Brand lockup (logo + "Copero") | sí | no |
| Nav links: Simulador · Crea tu carrera · Carrera completa · Carrera rápida · Cómo jugar · Mecánicas · FAQ | sí (7 links) | **no** |
| LanguageSwitcher (selector ES/EN/ZH-CN/...) | sí | **no** |
| Toggle de menú mobile | sí | no |
| CTA primario "Jugar" / "Play" en header | sí (verde) | **no** |

**Gap P0** — la home actual no tiene navegación persistente. El usuario que llega por deep-link no puede saltar a FAQ ni a Cómo jugar sin hacer scroll full-page. La referencia expone el patrón estándar de landing.

### 3.2 Hero / above-the-fold

| Elemento | kiya (referencia) | `copero.mgcstudios.app` |
| --- | --- | --- |
| Eyebrow `JUEGO DE FÚTBOL · SIMULADOR DE CARRERA` | sí (en hero, no en header) | sí (`COPERO · SIMULADOR DE CARRERA`) — parcial |
| Title multi-línea `COPERO JUEGO: CREA TU PROPIA CARRERA DE FÚTBOL` | sí | **no** — actual es single-line `Convertite en leyenda` |
| Body del hero | sí (≥ 2 frases) | sí (1 frase) |
| CTA primario verde `Empezar una carrera` | sí | sí (`Empezar carrera` — verde) |
| CTA secundario `Ver cómo se juega` | sí | **no** |
| Tag-list `Juego online · Draft 8 atributos · Modo carrera · Guardado local` | sí (4 chips) | **no** |

**Gap P0** — los chips de tag-list son parte del patrǿn SEO/scannability del referente y alimentan los JSON-LD. Cero impacto visual negativo, alto impacto en discoverability.

**Gap P1** — el CTA secundario "Ver cómo se juega" como ancla a `#how-to-play` reduce bounce en primera visita. Ausente.

### 3.3 Form de identidad (starter)

| Elemento | kiya (referencia) | `copero.mgcstudios.app` |
| --- | --- | --- |
| `HomepageCareerStarter` form completo en home | sí | **no** |
| Eyebrow `Juega desde la primera pantalla` | sí | no |
| Title `Crea tu futbolista` | sí | no |
| Apellido (input, maxLength 24) | sí | **no** |
| Dorsal (number input, 1–99) | sí | **no** |
| Pierna hábil segmented Izq / Der | sí | **no** |
| Nacionalidad select (priority FIFA + alfabético) | sí (~220 países) | **no** |
| Posición select (GK, CB, LB, RB, CDM, CM, CAM, LW, RW, ST) | sí | **no** |
| Herencia (details/summary, opcional) | sí | **no** |
| Modo de draft Classic vs Purist (segmented) | sí | **no** |
| Submit `Empezar carrera` (desde form) | sí | **no** (sólo CTA al `/simulador-carrera/identity`) |
| Microcopy `Gratis · Sin cuenta · Guardado local en este navegador` | sí | **no** |

**Gap P0** — el formulario en home es la decisión arquitectónica más visible de la referencia. Tener que saltar a `/simulador-carrera/identity` antes de empezar rompe el flujo "scroll → play" del referente. Sin embargo, **separar el form en una ruta dedicada también es una decisión de UX defendible** para mobile (más espacio, mejor validación). La pregunta para MGC-641 es: ¿el operador quiere emular literalmente la referencia o quiere mantener la ruta dedicada?

### 3.4 Preview de camiseta

| Elemento | kiya (referencia) | `copero.mgcstudios.app` |
| --- | --- | --- |
| Aside preview-shirt con bandera + dorsal + nombre | sí | **no** |
| Dorsal grande (centered) | sí | sí (chip OVR, no dorsal) |
| Nombre del jugador (placeholder fallback `ROOKIE` → `Rookie`) | sí | sí (`TU JUGADOR` fallback cuando no hay carrera) |
| Meta preview: bandera país + nombre país | sí | sí (post-carrera) |
| Meta preview: modo draft (Classic / Purist) | sí | **no** |
| Draft track visual (8 markers) | sí | **no** |
| Hint `El siguiente paso es el draft de ocho atributos con leyendas` | sí | **no** |

**Gap P1** — la preview del referente tiene tres micro-elementos (draft track 8-markers, hint, modo draft) que dan contexto inmediato del próximo paso. La versión actual sólo muestra dorsal/nombre/país.

**Gap P2** — el fallback string es `TU JUGADOR` vs `Rookie` de la referencia. Ambos son válidos; el nuestro es más literal.

### 3.5 Sección "Cómo jugar" / pasos

| Elemento | kiya (referencia) | `copero.mgcstudios.app` |
| --- | --- | --- |
| Eyebrow `Cómo jugar a Copero` | sí | sí (`CÓMO SE JUEGA`) |
| Title | sí (`Cómo jugar a Copero: de crear tu jugador al retiro`) | no (sin h2 — el eyebrow es h1 directamente) |
| Pasos numerados | **4 pasos** | **3 pasos** |
| Step 1 `Crea tu jugador` | sí | sí (`Definí tu identidad`) — alineado |
| Step 2 `Completa el draft de 8 atributos` | sí | sí (`Pasá por la academia`) — alineado |
| Step 3 `Elige dónde empieza tu carrera` | sí | **no** |
| Step 4 `Vive temporadas, fichajes y decisiones` | sí | sí (`Viví tu carrera`) — alineado |
| Modo Classic / Purist (comparación) | sí | **no** |
| Sección mecánica (`Atributos y posición`, `Clubes y roles`, `Eventos`) | sí | **no** |

**Gap P1** — paso 3 de la referencia ("Elige dónde empieza tu carrera" — elección de club inicial) está absorbido por la pantalla de dashboard. La decisión de moverlo a una ruta dedicada es razonable, pero pierde el "primer partido" del flujo home.

**Gap P1** — el comparador Classic vs Purist no existe en la home actual. La elección de modo de draft se hace en `/simulador-carrera/identity` (vía el segmented "Modo draft" que sí está implementado en `app/simulador-carrera/identity.tsx`, no en home).

### 3.6 FAQ

| Elemento | kiya (referencia) | `copero.mgcstudios.app` |
| --- | --- | --- |
| Sección FAQ | sí | sí |
| Nº de items | **≥ 6** (duración, cambio de club, retiro, guardado, multijugador, precio) | **4** (duración, cambio de club, retiro, guardado) |
| Anchor `#faq` en nav | sí | no (no hay nav) |

**Gap P2** — faltan al menos 2 items. Las preguntas frecuentes extras de la referencia cubren precio y multijugador (off-topic para Copero que es single-player), así que el gap real es 1–2 items vs los 6+ de la referencia.

### 3.7 Footer

| Elemento | kiya (referencia) | `copero.mgcstudios.app` |
| --- | --- | --- |
| `<footer>` con links legales | sí | **no** |

**Gap P1** — falta el footer. En el bundle actual ni siquiera hay un anchor de copyright visible.

### 3.8 Tag "PUBLICIDAD"

La referencia no tiene placeholder de ads visible en el hero; nuestro bundle muestra `PUBLICIDAD` (texto literal) debajo de la CTA. Es una decisión consciente de MGC-510/AdMob, pero rompe el flow visual. **Gap P2 — defecto conocido, no P0.**

---

## 4. Lista priorizada de gaps

### P0 — bloqueante para "fidelity with reference"

1. **Header con nav + LanguageSwitcher ausentes en home.** El usuario no tiene rutas secundarias visibles. Solución: importar `SiteHeader` (referencia) o portar `app/_layout.tsx` con un `<Stack.Screen options={{ headerShown: true, ... }} />`. El repo no tiene `SiteHeader` propio, hay que crearlo (≈ 70 líneas de TSX + CSS).
2. **Tag-list `Juego online · Draft 8 atributos · Modo carrera · Guardado local` ausente.** Solución: 4 chips `CategoryChip` ya existentes en `src/design/components/`. Costo: ~15 líneas.
3. **Title multi-línea "COPERO JUEGO: CREA TU PROPIA CARRERA DE FÚTBOL" ausente.** Solución: split del H1 actual + segunda línea. Costo: 4 líneas.
4. **CTA secundario "Ver cómo se juega" ausente.** Solución: `<Button variant="ghost">` con anchor a `#how-to-play`. Costo: 5 líneas.

### P1 — mejora visual / SEO

5. **Draft track 8-markers + hint en preview.** Refuerza "8 atributos" como mensaje de marca.
6. **Footer con copyright + links a Privacy / Terms.**
7. **Comparador Classic vs Purist en home.** Hoy vive en `/simulador-carrera/identity`. Decidir si se duplica.
8. **2 FAQ items extra** (multijugador off-topic → mejor: "¿Cuánto cuesta?" + "¿Necesito internet?").

### P2 — nice-to-have

9. **Selector de país con bandera inline** (referencia usa `<img src={flagUrl(...)}>` al lado del select).
10. **Modo de draft visible en preview-shirt** (no sólo en form).
11. **Fallback string `TU JUGADOR` → `Rookie`** (o mantener `TU JUGADOR` por consistencia con CTAs).
12. **CTA mobile en nav-header** ("Jugar" sticky en mobile).

---

## 5. Recomendaciones por sección

### Header
- **Acción:** crear `src/design/components/SiteHeader.tsx` con: brand lockup, nav (Simulador, Crea tu carrera, Carrera completa, Carrera rápida, Cómo jugar, Mecánicas, FAQ), LanguageSwitcher (selector ES/EN/ZH-CN), CTA `Jugar` verde, mobile menu toggle. Wire en `app/_layout.tsx`.
- **Riesgo:** el bundle actual pesa 412 KB gz (MGC-543). Agregar `LanguageSwitcher` introduce ~2–3 KB y un set de rutas i18n. Aceptable.
- **Owner sugerido:** mobile-developer (estructura), Designer (contenido + accesibilidad).

### Hero
- **Acción:** mantener "Convertite en leyenda" como H1 visible pero añadir segunda línea `Crea tu propia carrera de fútbol` debajo para matchear SEO title del referente.
- **Tag-list:** añadir chips `CategoryChip` con los 4 valores. Cada chip con `accessibilityRole="text"`.
- **CTA secundario:** anchor `Button variant="ghost"` → `#how-to-play`.

### Form de identidad (decisión para MGC-641)
- **Opción A (literal a la referencia):** mover el form completo a home. Implica duplicar validaciones y reordenar flow. Costo: 1 PR mobile-developer, ~300 líneas.
- **Opción B (status quo +):** mantener ruta `/simulador-carrera/identity`, añadir preview-shirt "starter" en home con CTA "Empezar carrera" → salta al form. Costo: 0 PR, sólo copy tweak.
- **Recomendación:** **Opción B**. El form en home es excelente en desktop pero se rompe en mobile < 380 px. Mantener la ruta dedicada es defendible. Documentar la decisión en ADR.

### Preview-shirt
- Draft track 8-markers: SVG inline o RN `<View>` array. ~10 líneas.
- Hint copy: `El siguiente paso es el draft de ocho atributos con leyendas` (ya en `src/design/copy/es-AR/`? — verificar).

### Cómo jugar (3 → 4 pasos)
- Añadir paso "3. Elegí dónde empieza tu carrera" entre academia y "Viví tu carrera".
- Decisión de copy: alinear con `app/simulador-carrera/identity.tsx` para no duplicar cadenas.

### FAQ
- Añadir 2 items: `¿Necesito internet para jugar?` + `¿Cuánto cuesta Copero?`.
- Si la sección sigue creciendo, considerar `<details>` para progressive disclosure.

### Footer
- Crear `src/design/components/SiteFooter.tsx` (≈ 40 líneas). Links: Privacy, Terms, Contacto, GitHub. Copyright dinámico con año.

---

## 6. Lo que NO hay que tocar

- **Color del CTA principal** (verde / `#15803D` en light): el operador lo ha validado en múltiples tickets. No cambiar.
- **Jerarquía del hero card** (eyebrow → H1 → body → CTA → preview): es la decisión central de MGC-505/MGC-556. No reordenar.
- **Lazy-load de `JerseyPreview`**: introduce CLS-safe fallback. No remover.
- **`PUBLICIDAD` placeholder**: requerido por AdMob. Mantener.

---

## 7. Próximos pasos

1. **CTO** revisa y decide Opción A vs Opción B para el form de identidad.
2. **Designer** desglosa P0 en 3 PRs (`SiteHeader+LanguageSwitcher`, `Hero chips+multi-line title`, `Footer`).
3. **mobile-developer** implementa los 3 PRs.
4. **QA** corre suite Playwright (MGC-556) + axe gate WCAG AA.
5. Una vez mergeado, re-correr `copero.mgcstudios.app` vs la nueva build y anexar screenshots a este directorio.

---

## Anexo A — capturas locales

- `captures/copero-mgc-desktop-1440-fold.png` — home actual above-the-fold (1440×900).
- `captures/copero-mgc-desktop-1440-full.png` — home actual full-page.
- `captures/copero-mgc-mobile-390-fold.png` — home actual above-the-fold (390×844 iPhone 14).
- `captures/copero-mgc-mobile-390-full.png` — home actual full-page mobile.

## Anexo B — evidencia de hijack `copero.top`

- `captures/copero-top-desktop-1440-fold.png` — AliExpress landing.
- `captures/copero-top-desktop-1440-full.png` — AliExpress landing full.
- `captures/copero-top-mobile-390-fold.png` — morningestone.com landing.
- `captures/copero-top-mobile-390-full.png` — morningestone.com landing full.
- DOM dumps en `dom/copero-top-*.json` muestran el payload de las redes de ads (AliExpress search inputs, morningestone tracking params).

## Anexo C — repo de referencia clonado

`scratch/kiya-copero/` (no commiteado) — clon shallow de `github.com/kiya0908/copero`. Componentes clave inspeccionados:

- `src/components/layout/SiteHeader.tsx` (73 líneas) — referencia 1:1 para nuestro header.
- `src/components/layout/LanguageSwitcher.tsx` (37 líneas) — selector de locale compacto.
- `src/components/layout/SiteFooter.tsx` (30 líneas) — footer mínimo.
- `src/components/home/HomepageCareerStarter.tsx` (247 líneas) — form completo + preview-shirt + draft track.
- `src/i18n/locales/es/home.json` — copy ES alineado con la auditoría.

Co-Authored-By: Claude <noreply@anthropic.com>
