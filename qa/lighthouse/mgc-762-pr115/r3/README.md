# MGC-762 PR #115 (SHA 2be21769) — LH mobile perf + axe — VEREDICTO FAIL

**Fecha**: 2026-08-25
**Branch**: `fix/mgc-762-code-split-entry-bundle`
**SHA evaluado**: `2be21769` — `fix(web): getComponent lazy para simulador-carrera screens + mover a features MGC-771`
**Antecedente**: r2 falló con BLOCKER (eager `<script defer>` del chunk simulador-carrera en `dist/index.html`).
**Servidor prodlike**: `python3 /tmp/lh_server_762.py dist 8084` (gzip pre-compressed + Cache-Control immutable)
**Bundle**: `dist/` fresh `npm run build:web` en SHA 2be21769 + `gzip -9 -kf` por chunk
**Runs**: 3 (mobile / form-factor=mobile, throttling simulate slow-4G Moto G Power)

## Resultado LH mobile (mediana de 3 runs)

| Métrica | AC MGC-762 | Mediana PR #115@2be21769 (r3) | r2 (a3af445) | Baseline MGC-743 (133802c) | r1 (d3bef45) | Veredicto |
|---|---|---|---|---|---|---|
| Performance score | ≥ 90 | **82.0** | 83.0 | 74 | 55 | **FAIL** (-8 vs gate, -1 vs r2) |
| FCP | ≤ 1.5 s | **1.96 s** | 1.80 s | 4.0 s | 12.45 s | **FAIL** (+0.46s vs gate, +0.16s vs r2) |
| LCP | ≤ 2.5 s | **4.56 s** | 4.38 s | 4.4 s | 14.59 s | **FAIL** (+2.06s vs gate, +0.18s vs r2) |
| TBT | (no target) | 103 ms | 102 ms | — | 104 ms | — |
| CLS | (no target) | 0.0097 | 0.0097 | — | 0.0097 | OK |
| Speed Index | (no target) | 1.99 s | 2.00 s | — | 12.45 s | — |
| Transfer total | (no target) | **575.2 KB** | 571.1 KB | 412 KB (entry) | 2 334.7 KB | (+0.7 % vs r2, -75 % vs r1) |
| Transfer main entry chunk | (no target) | **343.2 KB (gz)** | 357.0 KB gz (sim-carrera eager) | 412 KB gz | n/a | (-4 % vs r2, -17 % vs MGC-743) |
| Transfer sim-carrera screens | (debería ser 0 si nunca se navega) | 6.9 KB gz (3 async chunks) | (eager en entry) | (no split) | n/a | ⚠️ cargados on-demand desde home |

**3/3 runs idénticos** (perf=82, FCP=1.95/1.96s, LCP=4.56s, transfer=575.2 KB ±0.1). `home-r{1,2,3}.json` adjuntos.

## BLOCKER code-reviewer (review 5022140760): FIXED ✅

Code-reviewer marcó en r2 que el chunk simulador-carrera se emitía como `<script defer>` en `dist/index.html` (eager load en `/` aunque el user nunca navegue). MGC-771 lo arregla:

**Antes (r2, SHA a3af445)** — 4 scripts eager en `dist/index.html`:
```html
<script src="/.../runtime-...js" defer></script>
<script src="/.../__common-...js" defer></script>
<script src="/.../index-7083ab2e...js" defer></script>   ← simulator-carrera screens
<script src="/.../index-0a52...js" defer></script>      ← entry
```

**Ahora (r3, SHA 2be21769)** — 3 scripts eager, screens fuera:
```html
<script src="/.../__expo-metro-runtime-...js" defer></script>
<script src="/.../__common-...js" defer></script>
<script src="/.../index-6c1640c64b55914b56f74086da2cbb37.js" defer></script>  ← main entry (1.3 MB raw / 343 KB gz)
```

Las pantallas `academy/dashboard/identity` se movieron a `src/features/simulador-carrera/screens/` y se registran con `Stack.Screen getComponent: () => import(...)` en `app/simulador-carrera/_layout.tsx`. Metro emite 3 chunks asincrónicos:

- `academy-2d6ff5249cf1e1c7411f909efc4f40e3.js` (3.3 KB raw / **1.6 KB gz**)
- `dashboard-593e007e0b129677ca31583972c69128.js` (7.7 KB raw / **2.4 KB gz**)
- `identity-e80e39359938731b040484c4af7484f9.js` (7.9 KB raw / **2.9 KB gz**)

Suma de los 3 sim-carrera async: **6.9 KB gz**. La navegación al simulador los trae dinámicamente.

## Top recursos transferidos (run 1, gzipped)

| Recurso | Transfer (gz) | Raw |
|---|---|---|
| `index-6c1640c64b…js` (main entry, eager) | **343.2 KB** | 1 296.9 KB |
| 4 × Inter WOFF2 (Regular/Medium/SemiBold/Bold) | 144.3 KB | 143.4 KB |
| favicon.ico | 14.4 KB | 14.2 KB |
| 4 × Poppins WOFF2 (Regular/Medium/SemiBold/Bold) | 44.3 KB | 43.4 KB |
| `__common-...js` (eager) | 9.2 KB | 32.9 KB |
| `HomepageCareerStarter-...js` (dynamic import on home) | 6.2 KB | 21.9 KB |
| `identity-...js` (async, sim-carrera screen) | 2.9 KB | 7.7 KB |
| `dashboard-...js` (async, sim-carrera screen) | 2.4 KB | 7.5 KB |
| `__expo-metro-runtime-...js` (eager) | 1.8 KB | 3.7 KB |
| `academy-...js` (async, sim-carrera screen) | 1.6 KB | 3.2 KB |
| `index-ac0c…js` (3.0 KB raw) | 1.4 KB | 3.0 KB |
| `engine-...js` + `RecommendedStrategy-...js` + HTML | 2.3 KB | 3.5 KB |
| **TOTAL** | **575.2 KB** | — |

## Causa raíz del FAIL AC1/AC2/AC3 a pesar del fix MGC-771

**MGC-771 FIXED el BLOCKER** (eager `<script defer>`), pero el **main entry chunk `index-6c1640c64b…js` (1 297 KB raw / 343 KB gz) sigue siendo el dominante** del transfer y del LCP. Ese chunk contiene:
- engine (`acceptClub` / `presupuesto` / draft reducer)
- Common chunks de Expo Router (Stack/Tabs/useRouter)
- Código de las screens que NO son simulador-carrera (home + cómo jugar + comparador + ...)
- `_layout` del simulador-carrera con el `Stack.Screen getComponent: () => import(...)`

**El LCP 4.56s** está dominado por parse/eval del main entry (343 KB gz ≈ 1.3 MB raw JS). Es ~10% peor que r2 (4.38s) — variación natural del simulador. No hay cambio estructural que baje el LCP hasta que el main entry se parta.

**El transfer apenas cambió** (571 → 575 KB) porque el r2 ya tenía el sim-carrera en el main entry (357 KB gz) y el r3 lo tiene en el mismo main entry (343 KB gz) + 3 chunks async de 6.9 KB. La diferencia es marginal.

**Para hit `perf ≥ 90` y `transfer ≤ 300 KB`** se necesita partir el main entry chunk de 343 KB gz. Candidatos:
1. **RNF / engine / draft reducer** (~80-100 KB gz estimado) — mover a async chunk lazy.
2. **Comparador Classic/Purista** (PR #95, MGC-658) — solo se usa en `/como-jugar`, no en home. Async.
3. **Cómo jugar screens** — fuera de `/`, no deben eager.
4. **Recomendador / SuggestedCareer / WireframePreview** — solo en home pero reusan el engine.

O bien: **pre-render server-side** del main entry para que la primera request traiga HTML ya pintado y el LCP baje a <2.0s.

## Axe-core (WCAG 2.0/2.1 AA)

| Resultado | r3 (2be21769) | r2 (a3af445) | Baseline MGC-743 |
|---|---|---|---|
| Violations | **1** | 2 | 2 |
| Passes | 29 | 28 | 27 |
| Incomplete | 3 | 3 | 3 |

### V1 — `aria-required-attr` (critical, 2 nodos) — **PRE-EXISTENTE** (MGC-658 comparador)

```
<div aria-label="Clásico" role="radio" tabindex="0">
<div aria-label="Purista" role="radio" tabindex="0">
```

Falta `aria-checked` (requerido para `role=radio`). Comparador Classic/Purista introducido en MGC-658. No bloquea MGC-762 (code-reviewer preexistente, requiere fix de role `radio` → `aria-pressed` o agregar `aria-checked`).

**Nota**: MGC-773 fix `aria-pressed` ya está mergeado en `407fff5` (HEAD main), pero **NO está en 2be21769** (este es el SHA evaluado). Re-correr axe en `62a2a50`/`407fff5` eliminaría esta violation. **No bloquea la evaluación del BLOCKER MGC-771**.

### V2 — `color-contrast` (serious, 4 nodos en r2) — **DESAPARECIÓ en r3**

La violation reportada en r2 sobre TagPill blanco `rgba(255,255,255,0.5)` dentro del banner morado `rgb(126,34,206)` (componiendo `#bf91e7` light purple → 2.49:1) **ya NO se reporta** en r3. La verificación visual del screenshot `home.png` muestra que la zona del banner ya no renderiza TagPill con la composición que detectó axe en r2. Probable causa: orden de preload/JS cambió entre a3af445 y 2be21769 (al mover sim-carrera screens a features, Metro reorganizó el bundle main entry y la composición CSS-layer de TagPill).

**Confirmar antes de merge**: ejecutar axe sobre el bundle de **production deploy** (no solo dev), ya que axe 4.13 puede tener heurística distinta a devtools. Si reaparece en deploy, abrir child `MGC-{NEW}-[fix-tagpill-banner-contrast]`.

## Acceptance criteria MGC-762

| AC | Target | Logrado | Status |
|---|---|---|---|
| AC1 LH perf ≥ 90 | 90 | 82.0 | **FAIL** (-8) |
| AC2 transfer ≤ 300 KB en / | 300 KB | 575.2 KB (total) | **FAIL** (+275 KB) |
| AC3 FCP ≤ 1.5s LCP ≤ 2.5s | 1.5 / 2.5 s | 1.96 / 4.56 s | **FAIL** (FCP +0.46 / LCP +2.06) |
| AC4 Vitest/Playwright en CI | verde | no medido en este ticket | pending CI |

**Veredicto global**: **FAIL** para MGC-762 AC1/AC2/AC3 — el **BLOCKER code-reviewer está FIXED** (eager load de sim-carrera eliminado del `index.html`), pero el **main entry chunk (343 KB gz / 1.3 MB raw) es ahora el nuevo blocker** para perf/transfer/LCP.

## Recomendación

1. **No mergear PR #115 todavía.** AC1/AC2/AC3 todavía fallan con números similares a r2 (-1 perf, +4 KB transfer). MGC-771解决了 el problema de eager load que pidió code-reviewer pero **no acerca la app a los gates de MGC-762**.
2. **Child MGC-{NEW}-[fix-main-entry-chunk-343KB-gz]**: partir el main entry chunk `index-6c1640c64b…js` (343 KB gz / 1.3 MB raw). Candidatos high-impact:
   - Engine/draft reducer (lazy en screens que lo usan)
   - Comparador Classic/Purista (ya solo en `/como-jugar`, lazy import)
   - Cómo jugar / FAQ screens (no en `/`, lazy)
   - Pre-render HTML del main entry en SSR (Expo Router web tiene `expo-router/head` + `getStaticPaths`).
3. **MGC-773 axe `aria-pressed` en comparador** ya mergeado en `407fff5` (HEAD main) — al rebasar este ticket, axe debería ir a 0 violations. **No bloquea** este ticket.
4. **Re-correr LH r4** después del nuevo split: expectativa transfer ≤ 200 KB, perf ≥ 90, LCP ≤ 2.5s.

## Reproducir

```bash
cd /Users/matiasgonzalocalvo/.paperclip/instances/default/projects/5f4a6c8a-cec3-48de-bf5c-5bb8a96f9b2c/529fd29c-0df0-4556-8944-56ce675b7f4f/_default
git checkout 2be21769
npm run build:web
gzip -9 -kf dist/index.html
for f in dist/_expo/static/js/web/*.js; do gzip -9 -kf "$f"; done
python3 /tmp/lh_server_762.py "$(pwd)/dist" 8084 &
for i in 1 2 3; do
  npx lighthouse http://127.0.0.1:8084/ --only-categories=performance \
    --form-factor=mobile --throttling-method=simulate \
    --chrome-flags="--headless=new --no-sandbox --disable-gpu" \
    --chrome-path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    --output=json --output-path=qa/lighthouse/mgc-762-pr115/r3/home-r$i.json --quiet
done
node qa/lighthouse/mgc-762-pr115/r3/axe.mjs
```

## Evidencia

- `home-r1.json` / `home-r2.json` / `home-r3.json` — LH reports completos
- `axe-summary.json` / `axe-full.json` — axe-core WCAG 2.0/2.1 AA (1 violation, pre-existente comparador)
- `axe.mjs` — script reproducible
- `home.png` — screenshot home render
