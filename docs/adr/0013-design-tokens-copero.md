# ADR-0013: Design tokens copero — coexistencia light/dark/copero

- Estado: Aceptado
- Fecha: 2026-08-24
- Ticket: MGC-555 (PR1)
- Autor: mobile-developer (aca5adfa-fe62-4f71-8c4a-e9da6e3a77b7)
- Decisor: CTO (review MGC-559)
- Reemplaza: implícito en PR MGC-555 / commit 177e114

## Contexto

MGC-554 cerró la spec visual copero.com.ar → Copero (RN). El spec §3.1
define una paleta `copero` (zinc-950 base + accent purple-500) distinta
de las paletas `light` y `dark` ya en uso, y §4 define migración de
Space Grotesk / DM Sans → Inter (body) + Poppins (headings).

La primera implementación (commit `177e114`) extendió
`src/design/tokens.ts` con `palette.copero` y `ThemeMode = 'copero'`
sin romper los consumidores C1/C2, pero el PR quedó bloqueado por:

1. **CI**: vitest stale en `tests/unit/design.test.ts:170` (esperaba
   `SpaceGrotesk`, recibió `Poppins`). Fix trivial en el mismo PR.
2. **CDN hardcoded** (`app/_layout.tsx` apuntaba a
   `fonts.gstatic.com/.../v19` y `/v24`). Google rota paths sin aviso
   y rompe runtime nativo offline-first.
3. **Accent `#A855F7` purple-500**: el dark de copero.com.ar usa
   emerald forest como acento identidad. La decisión queda abierta
   con designer.
4. **ADR requerido** (POLICIES §3): cambio transversal toca design
   tokens consumidos por C1/C2.

## Decisión

1. **Coexistencia de modos**. `ThemeMode = 'light' | 'dark' | 'copero'`.
   `palette.copero` es aditiva — `palette.light` y `palette.dark`
   intactas. Consumidores C1/C2 siguen resolviendo `colors(mode)` por
   el `Appearance` API (mockeado en test). Activación de `copero`
   queda diferida a un PR posterior con toggle explícito.

2. **Swap tipográfico no destructivo**. `fontFamily.display` y
   `fontFamily.body` cambian de valor; las claves (`display`, `body`,
   `mono`) se preservan para no romper consumidores. `mono`
   (JetBrains Mono) sigue code/datos.

3. **Carga de fuentes — paquete versionado, no CDN**.
   `@expo-google-fonts/inter` y `@expo-google-fonts/poppins` (ambos
   `^0.4.x`) reemplazan la descarga directa de WOFF2 desde gstatic:
   - **Nativo**: fuentes bundleadas en el binario (APK/IPA), cero
     requests de red, sin dependencia de rotación de paths.
   - **Web**: `expo-font` (`useFonts`) resuelve `@font-face` con
     `display=swap` automático y subset latin; fallback a `system-ui`
     si la fuente falla.

4. **Accent decision — cerrada (MGC-560, 2026-08-24)**. Designer
   confirma mantener `palette.copero.accent = '#A855F7'` (purple-500)
   como accent de identidad del arquetipo default. Justificación:
   spec MGC-554 §3.3 mapea purple-500 al HeroCard "Convertite en
   leyenda"; emerald-500 está reservado al rol `success` archetype
   (respuesta correcta / DISPONIBLE). No se abre PR follow-up.
   Cero consumidores activos a la fecha (activación diferida).

5. **PRs chicos por capa**. MGC-555 PR1 cubre tokens + fuentes;
   PR2+ cubren arquetipos (splash, question, progressbar, result),
   componentes (Header, HeroCard, Ticker, LeagueCard, BlogRow,
   Footer, PillButton) y activación del modo `copero`.

## Consecuencias

### Positivas

- Modo `copero` queda listo en tokens; sólo falta el switch runtime.
- Fuentes versionadas y bundleadas — CI reproducible, sin rotaciones
  de paths sorpresa.
- Coexistencia garantiza que `main` no rompe `qa.yml` ni
  Lighthouse; el aspecto del consumidor actual (light/dark) no
  cambia visualmente hasta activar `copero`.

### Negativas / Trade-offs

- Tamaño APK/IPA crece ~+120KB por familia (Inter+Poppins 400/500/600/700
  cada una). Mitigación: subset latin only; no incluir cyrillic/vietnamita.
- Build web incluye las fuentes vía `expo-font` resolve. Si el
  bundle web supera 350KB tras este PR, PR2 incluye code-split
  por ruta (patrón MGC-543).

## Referencias

- MGC-554 — spec visual copero.com.ar → Copero (parent de diseño).
- MGC-555 — implementar spec visual en Copero RN (mobile-developer).
- MGC-559 — review CTO MGC-555 PR1 (4 hallazgos, este ADR cubre H4).
- docs/simulador-carrera.md §MGC-297 — contrato original de tokens.
- ADR-0009 (referencia) — política de coexistencia de modos visuales.