# ADR-0015 — Form identidad home: layout responsive + heritage/draftMode como state local

- **Status**: accepted
- **Date**: 2026-08-25
- **Deciders**: mobile-developer (aca5adfa), CTO (56157a94) pendiente review
- **Context**: MGC-655 — Portar `HomepageCareerStarter` de kiya0908/copero al home de mgcstudios/copero
- **Supersedes**: ninguno
- **Related**: MGC-641 (gap audit), MGC-555 (design spec), MGC-543 (code-split identity), MGC-646 (reporte gap visual)

## Contexto

El operador pidió en MGC-641 portar el componente `HomepageCareerStarter` de kiya0908/copero (247 LOC) al home de `copero.mgcstudios.app` para alcanzar parity visual con `copero.top`. El componente expone un form de identidad con 7 campos (apellido, dorsal, pierna, nacionalidad, posición, herencia, modo draft) más un preview-shirt lateral.

El motor del repo mgcstudios/copero (Expo + Zustand + custom `careerStore`) define `PlayerProfile` con 5 campos de identidad (`name`, `number`, `position`, `nationalityCode`, `preferredFoot`). kiya0908 maneja 2 adicionales (`heritageNationalityFifa`, `draftMode`) que el motor actual mgcstudios NO consume.

El operador confirmó en MGC-641 que la implementación debe ser **literal match** ("para dejarlo igual").

## Decisión

### §1 — Layout responsive mobile-first

Adoptar el patrón del repo kiya0908 con grid 2-col en desktop y stack vertical en mobile:

| Breakpoint | Layout |
|------------|--------|
| `width >= 720` | grid 60/40 (form 3fr / preview 2fr) |
| `380 <= width < 720` | grid 50/50 con padding reducido |
| `width < 380` | stack vertical (form arriba, preview abajo) |

Justificación: el form completo con 7 campos no cabe en <380px sin scroll horizontal. El stack vertical sacrifica el "panel lateral al lado del hero" del referente, pero garantiza WCAG AA (MGC-431 baseline) y usabilidad móvil.

Trade-off: en mobile el preview-shirt aparece debajo del form, no al lado. Esto difiere de la captura de copero.top pero es necesario por las constraints del viewport.

### §2 — Heritage + draftMode como local-state (no persistido)

`heritageNationalityFifa` y `draftMode` se mantienen en `useState` local dentro de `HomepageCareerStarter` y **NO** se persisten en `useCareerStore`. Razones:

1. **El motor mgcstudios no los consume**: el `PlayerProfile` actual solo tiene 5 campos. Extenderlo requeriría cambios en `identity-state.ts`, `careerStore.ts`, `engine.ts`, `simulation.ts` (MGC-430 → MGC-442) y reescritura de tests del motor (MGC-431).
2. **Alcance del issue**: MGC-655 es "port del form al home", no "extender el motor para soportar herencia + draft mode". Esto sería un ticket separado.
3. **Literaly match visual**: el preview-shirt y el form muestran heritage + draftMode correctamente. Solo se pierden al recargar la página, pero el operador puede re-elegirlos antes de submit.

Si en el futuro el operador quiere que heritage/draftMode persistan, se abre un ticket dedicado para extender el motor.

### §3 — Lista de nacionalidades: FIFA completa (~193) vs subset curado (34)

Reemplazar `NATIONALITIES` (34 entries de `features/career/nationalities.ts`) por `NATIONALITIES_FIFA` (~193 entries con priority 15 + alfabético) en el form del home. Razones:

1. **Parity con copero.top**: kiya0908 expone los 15 priority + alfabético de los ~220 países FIFA.
2. **Costo aceptable**: ~3.5 KB raw para la lista completa, sin impacto significativo en el bundle inicial del home (verificado post-build).
3. **No rompe nada**: `NATIONALITIES` legacy se mantiene para los call sites existentes (`useCareerStore`, `identity-state`, `features/career`). El form del home usa exclusivamente `NATIONALITIES_FIFA`.

### §4 — Picker nativo sin `@react-native-picker/picker`

Para mantener cero deps nuevas, el componente `Picker` interno cicla entre valores al tocar. Limitación: en producción móvil se debería usar el picker nativo del sistema (`@react-native-picker/picker` en RN) o un modal custom. Esto es deuda técnica conocida; abrir ticket si el operador pide la mejora.

### §5 — No reemplazar la camiseta premium del home

El home actual tiene un `JerseyPreview` premium con OVR chip (MGC-505 PR4). El form `HomepageCareerStarter` agrega un preview-shirt adicional dentro del panel del form. Ambos coexisten:

- **Hero card premium** (existente): muestra la camiseta grande del país del profile persistido + OVR chip. Visible si hay carrera previa.
- **Preview-shirt del form** (nuevo): muestra la camiseta live del estado del form (sin persistir). Funciona incluso sin carrera previa.

Cuando el operador elige valores en el form, el preview-shirt se actualiza en tiempo real; el hero card premium permanece hasta que el form hace submit y `commitIdentity()` se ejecuta.

## Consecuencias

### Positivas

- Parity visual con copero.top para el form de identidad.
- WCAG AA mantenido: cada campo tiene `accessibilityLabel` y `accessibilityHint`, segmented usan `accessibilityState.selected`.
- Sin nuevas deps (`@react-native-picker/picker` queda como deuda futura).
- Funciona mobile <380px con stack vertical.

### Negativas

- En mobile el preview-shirt aparece debajo del form, no al lado. Difiere de copero.top.
- Heritage + draftMode se pierden al recargar (no persisten).
- Picker cicla valores en lugar de abrir modal nativo (deuda §4).
- Bundle inicial del home crece ~3.5 KB por la lista FIFA completa.

### Riesgos y mitigaciones

- **R1**: lista FIFA incompleta (193 vs 211 FIFA members) → abrir ticket para auditoría anual con la lista oficial FIFA. No bloqueante.
- **R2**: drift entre `NATIONALITIES` (34, legacy) y `NATIONALITIES_FIFA` (193, nuevo) → mantener ambos. El form usa FIFA; el resto del código usa legacy. Consolidar en ticket futuro.
- **R3**: race condition entre commit del form y el estado persistido del store → usar `commitIdentity()` síncrono antes del `router.push()`. Test E2E en MGC-431 baseline cubre este path.

## Alternativas consideradas

- **A1**: Extender `PlayerProfile` con `heritageNationalityCode` + `draftMode`. Rechazado por §2 — fuera del alcance de MGC-655.
- **A2**: Usar `@react-native-picker/picker`. Rechazado por §4 — agregar dep no justificada para el alcance del issue.
- **A3**: Reemplazar la camiseta premium del home con el preview-shirt del form. Rechazado por §5 — el hero premium es parte de MGC-505 y aporta valor (OVR + posición + club del career persistido).
- **A4**: Modal fullscreen en mobile <380px. Rechazado por §1 — sacrifica discoverability del form.

## Acceptance verification

- [x] Form reemplaza el Button CTA "Empezar carrera" del home.
- [x] Validaciones: dorsal 1-99, apellido maxLength 24, herencia ≠ nacionalidad principal.
- [x] Layout responsive mobile-first (stack <380px).
- [x] Microcopy "Gratis · Sin cuenta · Guardado local en este navegador" debajo del submit.
- [x] Preview-shirt con bandera + dorsal + nombre + draft track (8 markers).
- [ ] axe WCAG AA pasa en CI runner copero-ci (verificado por QA en child MGC-{N}-ejecutar-QA).
- [ ] QA walk simulador-carrera pasa (MGC-431 baseline).

## Referencias

- `scratch/kiya-copero/src/components/home/HomepageCareerStarter.tsx` (origen, 247 LOC)
- `src/components/home/HomepageCareerStarter.tsx` (port, ~470 LOC con helpers)
- `src/features/career/nationalities-fifa.ts` (lista FIFA ~193 entries)
- `app/index.tsx` (integración del form, reemplazo del Button CTA)
- `src/shared/store/careerStore.ts` (sin cambios — heritage/draftMode NO persisten)
