# ADR-0014: Form de identidad en home (Opción A) vs ruta dedicada (Opción B)

- Estado: Aceptado
- Fecha: 2026-08-25
- Ticket: MGC-659 (parent MGC-641)
- Autor: cto (56157a94-6f29-4c01-9fc2-855a43767818)
- Decisor: Operador (vía MGC-641, "para dejarlo igual")

## Contexto

La auditoría visual MGC-646 (PR #90, sha 154b7042) comparó `copero.mgcstudios.app` contra el referente `github.com/kiya0908/copero` (clonado en `scratch/kiya-copero/`). El dominio `copero.top` está hijackeado (AliExpress/morningestone.com) y no sirve snapshots.

Gap P0 del referente: el form completo de identidad (apellido, dorsal, pierna hábil, nacionalidad, posición, modo draft) vive en **home**, mientras nuestro bundle lo deriva a `/simulador-carrera/identity` (ruta dedicada).

Operador explícito en MGC-641: *"lee el codigo y basate en eso y para dejarlo igual"* — exige fidelidad literal al referente.

## Decisión

**Opción A: portar `HomepageCareerStarter` (247 LOC, kiya0908/copero) al home.**

- Mantener `/simulador-carrera/identity` como fallback para deep-links.
- Componentes a portar: `src/components/home/HomepageCareerStarter.tsx`, draft track, preview-shirt.
- Validaciones: dorsal 1-99, apellido maxLength 24, nacionalidad FIFA priority + alfabético.
- Track child: MGC-655 (mobile-developer, aca5adfa).

## Rationale

1. **Alineación con el brief operador en MGC-641**: literal match gana sobre UX defensible.
2. **SEO/scannability**: el form en home refuerza el patrón "starter" del referente y alimenta JSON-LD descubribility.
3. **Friction-1 entre landing y draft**: el flujo `scroll → play` del referente reduce bounce en primera visita.
4. **Bundle size**: +15 KB gz estimado; aceptable post-MGC-543 code-split. Validar en runner `copero-ci` con `npm run build:web`.

## Consecuencias

- **Positivas**:
  - Fidelidad 1:1 con referente en home.
  - Menor paso entre landing y carrera activa.
  - Documenta decisión explícita para futuras divergencias.

- **Negativas / mitigaciones**:
  - Layout mobile < 380 px requiere device farm dedicada. Mitigación: QA walk `simulador-carrera` Playwright iPhone SE 375 px.
  - Bundle +15 KB gz requiere gate MGC-539 (g4 splitChunks) en CI.
  - Duplicación potencial con `/simulador-carrera/identity`. Mitigación: la ruta dedicada absorbe deep-links existentes (MGC-431), home canónica.

- **Reversibilidad**: alta. Si operador cambia de opinión, basta con esconder el form vía feature flag y promover la ruta dedicada a canónica. ADR a actualizar.

## Tickets relacionados

- MGC-641 parent ("necesito que verifiques bien")
- MGC-646 gap audit (sha 154b7042)
- MGC-653 SiteHeader + LanguageSwitcher
- MGC-654 Hero multi-línea + tag-list + CTA secundario
- MGC-655 Form identidad home Opción A (track de implementación)
- MGC-656 Draft track 8-markers + hint preview
- MGC-657 SiteFooter
- MGC-658 Cómo jugar 4 pasos + comparador + FAQ extra
