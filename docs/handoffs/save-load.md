# Handoff — Save / Load

**Flow source**: `docs/flows/save-load/flow.md`
**Screens**: `docs/screens/save-load/source/`

## Pantallas

1. **`01-lista-saves.html`** — Lista de 5 slots con metadata
   - Header: progress bar "3/5 slots usados"
   - Body: 3 save-slots ocupados (current highlight primary + 2 normales) + 2 slots vacíos (dashed border)

2. **`02-confirm-overwrite.html`** — Modal de confirmación con backdrop
   - Body modal: warning icon + "Sobrescribir partida" + card partida destino + card partida actual (highlight) + callout danger

3. **`03-auto-save-indicator.html`** — Estado de autoguardado
   - Header: chip "Auto" con dot verde
   - Body: toast indicator + card estado (último/frecuencia/próximo) + historial de autoguardados

## Componentes RN

- `<SaveSlotList>` (lista 5 con metadata)
- `<SaveSlotRow>` (`save-slot` con current/normal/empty variants)
- `<OverwriteConfirmModal>` (bottom sheet con 2 cards)
- `<AutoSaveIndicator>` (toast top + header chip)
- `<AutoSaveHistory>` (lista de guardados)

## Tokens

- `colors('copero').primary` para current save slot border
- `colors('copero').warning` para warning icon overwrite
- `colors('copero').danger` para callout danger
- `chip--success` para "Activo" en persistencia
- `chip--danger` para "Borrar" en overwrite

## Estados

- Default: lista con slots
- Empty: todos slots vacíos → CTA "Nueva carrera"
- Loading: spinner al cargar save
- Error: "No se pudo cargar la partida"

## Acceptance criteria visuales

- [x] Lista saves con timestamp, temporada, equipo
- [x] Confirm modal antes de overwrite (con doble confirmación)
- [x] Auto-save indicator en header (con dot verde)