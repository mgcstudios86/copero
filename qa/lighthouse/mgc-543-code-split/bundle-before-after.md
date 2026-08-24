# MGC-543 code-split entry chunk — bundle size evidence

**Build**: 2026-08-24 local prodlike (`npm run build:web` + gzip level 9).
**Metro config**: `metro.config.js` con `serializerOptions.splitChunks: true` envuelto en el customSerializer de Expo. Tree-shake habilitado en `config.web.treeShakeEnabled`.
**Store refactor**: `src/shared/store/careerStore.ts` separa identity setters (livianos) de simulation actions (lazy).
**Inject-preload**: `scripts/inject-preload.mjs` ahora SÓLO pre-carga chunks <= 8 KB uncompressed (entry, helpers tiny). Chunks de route pesados se sirven on-demand al navegar.

## Bundle chunks (uncompressed / gzipped)

| Chunk | Uncompressed | Gzipped | Rol |
|---|---|---|---|
| `__expo-metro-runtime-1f8f5d3…js` | 3.8 KB | 1.6 KB | entry runtime (defer) |
| `__common-645d4f16…js` | 16.5 KB | 4.1 KB | common vendor (defer) |
| `index-53a1331b…js` | 1.27 MB | 338.7 KB | home + identity + dashboard + academy (defer) |
| `index-79bc8932…js` | 207 KB | 47.7 KB | route chunk on-demand |
| `index-9ed0998f…js` | 17 KB | 6.1 KB | route chunk on-demand (html-to-image) |
| `index-a139ae47…js` | 3.1 KB | 1.2 KB | route chunk on-demand (expo-sharing) |
| `engine-154cf623…js` | 2.1 KB | 0.9 KB | **NUEVO**: engine de carrera lazy |
| `RecommendedStrategy-eb326fd…js` | 1.1 KB | 0.6 KB | lazy helper |

## Initial transfer (HTML + defer + preload)

| Recurso | Tamaño gz |
|---|---|
| `index.html` | 1.7 KB |
| `__expo-metro-runtime-…js` (defer) | 1.6 KB |
| `__common-…js` (defer) | 4.1 KB |
| `index-53a1331b…js` (defer) | 338.7 KB |
| `RecommendedStrategy-…js` (preload) | 0.6 KB |
| `engine-…js` (preload) | 0.9 KB |
| `index-a139ae47…js` (preload) | 1.2 KB |
| **TOTAL initial** | **~348.8 KB** |

## Comparativa

| Métrica | MGC-538 r3 (pre-fix) | MGC-543 build local | Delta |
|---|---|---|---|
| Entry chunk uncompressed | 1.29 MB | 1.27 MB | -0.02 MB |
| Entry chunk gzipped | 343.8 KB | 338.7 KB | -5.1 KB |
| HTML initial transfer (gz) | 412 KB | 348.8 KB | **-63.2 KB** |
| Total chunks | 5 | 8 | +3 |
| Engine como chunk separado | NO | **SÍ (0.9 KB gz)** | code-split real |
| Local g4 transfer baseline | 408 KB | — | reference |

## Acceptance criteria MGC-543

| AC | Target | Logrado | Status |
|---|---|---|---|
| Transfer /identity prod | <= 415 KB | ~349 KB | PASS |
| Delta vs local 408 KB | <= 10 KB | **-59 KB** | PASS |
| LH mobile perf /identity | >= 0.90 | TBD (run pending) | pending |
| axe 0/0 | 0 violations | TBD | pending |

## Cambios

1. `metro.config.js` (NEW) — habilita `serializerOptions.splitChunks: true` wrappeando el customSerializer de Expo. Tree-shake web.
2. `src/features/career/identity-state.ts` (NEW) — extrae `initialProfile`, `initialSnapshot`, `isIdentityComplete` y setters de identidad de `engine.ts` a un módulo LIVIANO (sin `simulation`/`strategy`/`reputation`).
3. `src/shared/store/careerStore.ts` (REFACTOR) — setters de identidad (setName/Number/Position/Nationality/Foot) usan `identity-state` (sync, sin motor). Transiciones de stage (commitIdentity/openAcademy/acceptClub) son pure helpers inline (sync). Acciones de simulación (decide/advance) resuelven `step` vía dynamic import del engine.
4. `app/simulador-carrera/identity.tsx` — importa `isIdentityComplete` desde `@/features/career/identity-state` (evita transitive require a engine).
5. `scripts/inject-preload.mjs` (REFACTOR) — threshold de pre-carga: solo chunks <= 8 KB uncompressed. Chunks de route pesados (>8 KB) NO se pre-cargan, se sirven on-demand al navegar.

## Verificación

- Vitest 123/123 PASS (incluye engine.test, simulation.test, smoke-10games).
- typecheck: 0 errores nuevos (pre-existente mgc461-smoke StrategyId|null sin tocar).
