# MGC-762 PR #115 (SHA a3af445) — LH mobile perf + axe — VEREDICTO FAIL (parcial)

**Fecha**: 2026-08-25
**Branch**: `fix/mgc-762-code-split-entry-bundle`
**SHA evaluado**: `a3af445` — `fix(web): code-split simulator-carrera screens + fix splitChunks MGC-762`
(HEAD force-pushed; incluye MGC-743 WOFF2 fonts `133802c` + PR #111 WCAG banner `c79ac34`)
**Servidor prodlike**: `python3 /tmp/lh_server_762.py dist 8084` (gzip pre-compressed + Cache-Control immutable)
**Bundle**: `dist/` fresh `npm run build:web` + `gzip -9 -kf` por chunk
**Runs**: 3 (mobile / form-factor=mobile, throttling simulate slow-4G Moto G Power)

## Resultado LH mobile (mediana de 3 runs idénticos)

| Métrica | AC MGC-762 | Mediana PR #115@a3af445 | Baseline MGC-743 (SHA 133802c) | r1 (d3bef45 sin MGC-743) | Veredicto |
|---|---|---|---|---|---|
| Performance score | ≥ 90 | **83.0** | 74 | 55 | **FAIL** (-7 vs gate, **+9 vs MGC-743**) |
| FCP | ≤ 1.5 s | **1.80 s** | 4.0 s | 12.45 s | **FAIL** (-55% vs MGC-743, +0.30s vs gate) |
| LCP | ≤ 2.5 s | **4.38 s** | 4.4 s | 14.59 s | **FAIL** (+1.88s vs gate, ~ baseline) |
| TBT | (no target) | 102 ms | — | 104 ms | — |
| CLS | (no target) | 0.0097 | — | 0.0097 | OK |
| Speed Index | (no target) | 2.00 s | — | 12.45 s | — |
| Transfer total | (no target) | **571.1 KB** | 412 KB (entry) | 2 334.7 KB | (-75 % vs r1, +38 % vs MGC-743) |
| Transfer entry chunk | ≤ 300 KB | **46.5 KB (gz)** ✅ | 412 KB (gz) | 357.6 KB | **PASS entry** (-87%) |
| Transfer sim-carrera chunk (eager) | (debería ser 0 en /) | **357.0 KB gz** (1 355 KB raw) | (no split) | n/a | ⚠️ eagerly loaded |

**3/3 runs idénticos** (perf=83, FCP=1.80s, LCP=4.38s, transfer=571.1 KB). `home-r{1,2,3}.json` adjuntos.

## Top recursos transferidos (run 1)

| Recurso | Transfer (gz) | Raw |
|---|---|---|
| `index-7083…js` (sim-carrera screens, **eager**) | 357.0 KB | 1 355 KB |
| 4 × Inter WOFF2 (400/500/600/700) | 144.6 KB | 144.7 KB |
| `index-0a52…js` (entry chunk post-split) | 46.5 KB | 207 KB |
| 4 × Poppins WOFF2 (400/500/600/700) | 44.5 KB | 44.4 KB |
| favicon + preloads + engine + __common + __runtime | 6.3 KB | — |
| HTML (gz) | 1.2 KB | 2.1 KB |
| **TOTAL** | **571.1 KB** | — |

## Causa raíz del FAIL AC1/AC2/AC3

**Code-split del entry SÍ funciona**: entry chunk pasó de 412 KB gz (MGC-743 baseline) → **46.5 KB gz** ✅ (-87%).

**Pero el chunk `index-7083ab2e…js` (simulator-carrera screens, 1 355 KB raw / 357 KB gz) NO está diferido** — se carga eagerly como `<script src="...">` en `dist/index.html`. Confirmado:

```bash
$ grep 'src=' dist/index.html
src="/_expo/static/js/web/__expo-metro-runtime-1f8f5d3ca6b7f58204d51e14506d73fb.js"
src="/_expo/static/js/web/__common-a2b93fd16d9318656289d740d039e005.js"
src="/_expo/static/js/web/index-7083ab2e9d13586215598cb4076c8ee4.js"   ← simulator-carrera screens
```

Transfer total en `/` = entry (46.5 KB) + sim-carrera (357 KB) + WOFF2 fonts (~189 KB) + favicon (14 KB) + misc = **571 KB**.

Expo Router trata cada route file (`app/simulador-carrera/{academy,dashboard,identity}.tsx`) como entry point de la SPA y emite `<script defer>` para ellos en el `index.html`, independientemente de si el user está en `/` o en `/simulador-carrera/{academy,dashboard,identity}`. La estrategia `lazy()` interna (PR #115 wrappers) sólo afecta a react-tree, no a la carga del chunk en el navegador.

Para hit `perf ≥ 90` y `transfer ≤ 300 KB` el chunk sim-carrera debe ser **lazy** (true dynamic import / mover screens fuera de `app/` a `src/` con `Stack.Screen` lazy, patrón MGC-544 ronda/categoria/fin).

**LCP 4.38s idéntico a baseline MGC-743**: el LCP element está bloqueado por el parse/eval del chunk sim-carrera (357 KB gz ≈ 1.4 MB raw JS). Sin diferir, LCP no baja.

## Axe-core (WCAG 2.0/2.1 AA)

| Resultado | Cuenta |
|---|---|
| Violations | **2 (1 critical + 1 serious)** |
| Passes | 28 |
| Incomplete | 3 |

### V1 — `aria-required-attr` (critical, 2 nodos) — **PRE-EXISTENTE**

```
<div aria-label="Clásico" role="radio" tabindex="0">
<div aria-label="Purista" role="radio" tabindex="0">
```

Falta `aria-checked` (requerido para `role=radio`). **Comparador Classic/Purista de MGC-658**. Pre-existente en ancestry de PR #115, **no introducido por MGC-762**. Flag para child bug aparte (no bloquea MGC-762).

### V2 — `color-contrast` (serious, 4 nodos) — **REGRESIÓN WCAG sobre PR #111 banner morado**

Chips `data-testid="home-tag-list"` (4 TagPills: "Juego online" / "Draft 8 atributos" / "Modo carrera" / "Guardado local") están dentro del banner morado `rgb(126,34,206)` introducido en **PR #111 (c79ac34 WCAG AA banner)**. Las pills tienen `background-color: rgba(255,255,255,0.5)` que sobre el morado compone a `#bf91e7` (light purple) → blanco encima = **2.49:1**, FAIL WCAG AA 4.5:1.

**Memory check**: MGC-654 (TagPill WCAG) y MGC-697 (banner WCAG AA) cerraron con axe 0 violations — pero esos fixes usaron **fondo claro** (TagPill `black α=0.10` da 4.77:1 sobre fondo claro). Sobre banner morado el `white α=0.5` no es suficiente. Misma familia que MGC-695 (alpha direction).

## Acceptance criteria MGC-762

| AC | Target | Logrado | Status |
|---|---|---|---|
| AC1 LH perf ≥ 90 | 90 | 83.0 | **FAIL** (-7) |
| AC2 transfer ≤ 300 KB en / | 300 KB | 571.1 KB (total) | **FAIL** (+271 KB; entry-only 46.5 KB ✅) |
| AC3 FCP ≤ 1.5s LCP ≤ 2.5s | 1.5 / 2.5 s | 1.80 / 4.38 s | **FAIL** (FCP +0.30 / LCP +1.88) |
| AC4 Vitest/Playwright en CI | verde | no medido en este ticket | pending CI |

**Veredicto global**: **FAIL** — PR #115@a3af445 mejoró vs MGC-743 (+9 perf, FCP -55%, entry chunk -87%) pero **no alcanza** AC1/AC2/AC3 por eager load del chunk sim-carrera.

## Recomendación

1. **No mergear PR #115 todavía.** AC1/AC2/AC3 todavía fallan.
2. **Child MGC-{NEW}-[fix-simulador-chunk-eager-load]**: mover `app/simulador-carrera/{academy,dashboard,identity}*.tsx` a `src/features/simulador-carrera/screens/*-impl.tsx` y registrar rutas vía `Stack.Screen` con `getComponent: () => require(...).default` lazy, para que Expo Router NO emita sus `<script defer>` en `index.html` de `/`. Re-correr LH r3 esperado: transfer ≤ 220 KB (-357 KB), LCP ≤ 2.0 s.
3. **TagPill sobre banner morado** (regresión WCAG): ajustar alpha o color. Subir `rgba(255,255,255,X)` a X ≥ 0.85 **o** cambiar texto a `colors.text` oscuro dentro de pill. Ticket `MGC-{NEW}-[fix-tagpill-contrast-banner-morado]`.
4. **aria-required-attr comparador Classic/Purista**: `MGC-{NEW}-[fix-aria-checked-comparador]` (no bloquea MGC-762).
5. **Tras los 3 fixes**: re-correr LH mobile + axe. Expectativa: entry-only transfer ≤ 100 KB gz, perf ≥ 90, FCP ≤ 1.5s, LCP ≤ 2.5s, axe 0 violations.

## Reproducir

```bash
cd /Users/matiasgonzalocalvo/.paperclip/instances/default/projects/5f4a6c8a-cec3-48de-bf5c-5bb8a96f9b2c/529fd29c-0df0-4556-8944-56ce675b7f4f/_default
git checkout a3af445
npm run build:web
gzip -9 -kf dist/index.html
for f in dist/_expo/static/js/web/*.js; do gzip -9 -kf "$f"; done
python3 /tmp/lh_server_762.py "$(pwd)/dist" 8084 &
for i in 1 2 3; do
  npx lighthouse http://127.0.0.1:8084/ --only-categories=performance \
    --form-factor=mobile --throttling-method=simulate \
    --chrome-flags="--headless=new --no-sandbox --disable-gpu" \
    --chrome-path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    --output=json --output-path=qa/lighthouse/mgc-762-pr115/r2/home-r$i.json --quiet
done
node qa/lighthouse/mgc-762-pr115/r2/axe.mjs
```

## Evidencia

- `home-r1.json` / `home-r2.json` / `home-r3.json` — LH reports completos
- `axe-summary.json` / `axe-full.json` — axe-core WCAG 2.0/2.1 AA
- `axe.mjs` — script reproducible
