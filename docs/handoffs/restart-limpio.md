# Handoff — Restart limpio

**Flow source**: `docs/flows/restart-limpio/flow.md`
**Screens**: `docs/screens/restart-limpio/source/`

## Pantallas

1. **`01-confirm-modal-3-pasos.html`** — Modal con stepper de 3 pasos
   - Body modal: warning icon + "¿Empezar de cero?" + stepper (paso 2/3 current) + card danger "Vas a perder" (4 items) + callout danger

2. **`02-reset-visual.html`** — Estado fresh post-wipe
   - Hero: 👋 + "¡Bienvenido de vuelta!" + "Elegí un equipo y empezá una nueva carrera"
   - Body: card "Próximos pasos" (3 steps con estado) + card "Resumen del reinicio" (storage liberado, cache invalidado, prefs)

3. **`03-loading-wipe.html`** — Loading screen durante wipe
   - Body: spinner grande + "Limpiando almacenamiento" + card con 5 pasos (✓ / spinner / ○ / ○ / ○) + cancel

## Componentes RN

- `<RestartStepper>` (3-step stepper con done/current/pending)
- `<RestartDangerCard>` (lista de lo que se va a perder)
- `<RestartLoadingProgress>` (spinner + checklist)
- `<FreshStateWelcome>` (hero + próximos pasos)

## Tokens

- `colors('copero').danger` para todo el flow de restart
- `colors('copero').warning` para stepper current step
- `colors('copero').success` para checks completados
- `stepper__step--done/current` para stepper

## Aclaraciones importantes

- El restart es IRREVERSIBLE — el modal tiene 3 pasos con stepper explícito.
- Idioma se conserva (no se pierde preferencia regional).
- Auto-guardado no cubre el restart → recomendación explícita de exportar save antes.

## Acceptance criteria visuales

- [x] Confirm modal "empezar de cero" (3 pasos, advertencia)
- [x] Reset visual al estado fresh-user
- [x] Loading screen durante wipe de storage

## Lo que NO está incluido

- Lógica de backup automático pre-restart (futuro)
- Confirmación por código PIN (futuro)