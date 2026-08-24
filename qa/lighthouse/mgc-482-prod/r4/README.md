# MGC-541 Lighthouse prod re-run round 4

**Audit**: 2026-08-24 14:10Z.
**Target**: `https://copero.mgcstudios.app/simulador-carrera/{identity,dashboard}`.
**Bundle prod**: sha `d8fd5227d6733a344b52b8dcd00ef1a4` (vigente post-MGC-505).
**Runner**: `copero-ci` workflow stack + lighthouse@13 local + Chrome for Testing 151.0.7922.34.
**Throttling**: `--form-factor=mobile --throttling-method=simulate` (Moto G Power + slow-4G).
**Tags axe**: `wcag2a`, `wcag2aa`, `wcag21aa`.

## Resultado

| Página | r1 perf | r2 perf | r3 perf | **median perf** | a11y | gate |
|---|---|---|---|---|---|---|
| /identity | 82 | 84 | 85 | **84** | 100 | ❌ perf (0.90 req) |
| /dashboard | 84 | 82 | 84 | **84** | 100 | ❌ perf (0.90 req) |

**axe-core**:
- `/identity`: 0 violations · 0 critical · 0 serious · 22 passes · 2 incomplete ✅
- `/dashboard`: 0 violations · 0 critical · 0 serious · 18 passes · 1 incomplete ✅

## Core Web Vitals (median 3 runs)

| Métrica | /identity | /dashboard | target LH ≥0.90 |
|---|---|---|---|
| FCP | 1.73 s | 1.68 s | ≤1.8 s ✅ |
| **LCP** | **4.00 s** | **4.03 s** | **≤2.5 s ❌** |
| TBT | 144 ms | 166 ms | ≤200 ms ✅ |
| CLS | 0.010 | 0.010 | ≤0.1 ✅ |
| Speed Index | 3.63 s | 2.54 s | ≤3.4 s ⚠️ |
| **Total transfer** | **473 KB** | **473 KB** | local gate 408 KB ❌ (+65 KB) |

## Comparativa vs gate local prodlike mgc-431-g4

| Página | g4 local median perf | g4 local LCP | g4 local transfer | **r4 prod median perf** | r4 prod LCP | r4 prod transfer |
|---|---|---|---|---|---|---|
| /identity | **0.92** | 3.30 s | 408 KB | **0.84** (-8) | 4.00 s | 473 KB (+65 KB) |
| /dashboard | **0.91** | 3.30 s | 408 KB | **0.84** (-7) | 4.03 s | 473 KB (+65 KB) |

**Veredicto**: gate **NO pasa**. Median prod perf = 0.84 en ambas páginas, debajo del 0.90 requerido. Axe 0/0 sí cumple.

## Diagnóstico delta prod vs local

| Aspecto | local g4 | prod r4 | delta |
|---|---|---|---|
| bundle hash | f25c1502 | d8fd5227 | mismo copy, distinto build env |
| transfer (KB) | 408 | 473 | **+65 KB** |
| LCP (s) | 3.30 | 4.00 | **+0.70 s** |
| FCP (s) | 1.35 | 1.73 | +0.38 s |
| TBT (ms) | 88–96 | 144–166 | +50–70 ms |
| CLS | 0.010 | 0.010 | 0 |
| Speed Index | 1.5 | 2.54–3.63 | +1.0–2.1 s |

El delta +65 KB transfer y +50–70 ms TBT empujan el LCP por encima del umbral LH 2.5 s, arrastrando perf a 0.84. Bajo throttling simulado slow-4G, esos +65 KB son ~0.7 s adicionales de LCP.

Causa raíz probable (heredada de MGC-482 / MGC-538):
1. **HTML SSR más pesado en prod** que en local (headers CF, scripts inline, cookies).
2. **Subsetting de fonts distinto** (latin local vs subset extendido prod).
3. **Rocket Loader / email-obfuscation de Cloudflare** que inyecten scripts inline.
4. **Bundle single-chunk**: el entry `index-d8fd5227…js` carga TODO el código upfront (Expo Router + screens + engine), 1.29 MB uncompressed / 412 KB gzipped. Sin code-split, todo se transfiere antes del primer paint interactivo.

## Acción

Gate **NO cierra**. Median 0.84 < 0.90 ⇒ abrir **child a devops** para code-split del entry chunk post-MGC-505. Owner asignado a `devops` (único perfil con acceso a `expo-router` build config y al runner `copero-ci`).

Hipótesis de mitigación (sugerencia, no decisión):
- Lazy import de pantallas no-críticas (`/simulador-carrera/identity` no necesita el bundle de `dashboard`, `estrategias`, etc.).
- Tree-shake de polyfills no usados en Safari/Chrome actuales.
- `expo-router` experimental `lazy: true` + `withRouteGuard` por ruta.

## Archivos

- `identity/simulador-carrera-identity-{1,2,3}.json` — Lighthouse JSON completos.
- `dashboard/simulador-carrera-dashboard-{1,2,3}.json` — Lighthouse JSON completos.
- `summary.json` — mediana + métricas core web vitals por página.
- `axe-summary.json` — axe-core wcag2a/aa/21aa (0/0).
- `axe-r4.mjs` — script Playwright + @axe-core/playwright reproducible.
