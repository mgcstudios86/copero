# ADR-0016: RNG seedeado — Mulberry32 propio

- Estado: Aceptado
- Fecha: 2026-09-04
- Ticket: MGC-1665 (origen), MGC-477 v2 (snapshot contract), MGC-497 (implementación copa)
- Decisión técnica reversible
- Versión: 2 (snapshot contract — D1/D3 agregados)

## Contexto

El motor de carrera necesita resultados reproducibles para tests de regresión y QA. La implementación vive en `src/features/career/rng.ts` y expone `RngSnapshot` para persistir el cursor entre sesiones.

## Decisión

Usar Mulberry32, sin dependencias nativas. El contrato persistible real es:

```ts
export type RngSnapshot = {
  v: 1;
  seed: number;
  cursor: number;
  algorithm: 'mulberry32';
};
```

`src/features/career/rng.ts` también exporta `snapshotRng`, `restoreRng` y `createRngFromSnapshot`. `snapshotToSave` usa el tipo en cada commit de `careerStore`; `loadCareerSave` devuelve el mismo shape y `hydrateFromSave` lo conserva.

## Upgrade path F3+

Antes de cambiar el algoritmo, agregar un discriminador nuevo y un campo opcional para el estado anterior:

1. Crear un parser específico para el `v` actual.
2. Mantener lectura de `RngSnapshot` v1 cuando sea compatible.
3. Convertir snapshots incompatibles con una migración explícita y testeada.
4. Persistir el nuevo discriminador atómicamente desde `snapshotToSave`.
5. Ejecutar roundtrip y tests deterministas antes de eliminar v1.

No mutar `v` en runtime sin migración. Esto permite reanudar desde el cursor correcto y evita que saves viejos se carguen como si usaran el algoritmo nuevo.

## Consecuencias

- `RngSnapshot` v1 guarda sólo seed, cursor y algoritmo; no expone el estado interno completo.
- Los saves v1 legacy se hidratan con `rng: { v: 1, seed, cursor: 0, algorithm: 'mulberry32' }`.
- Cambiar de algoritmo requiere parser, migración y bump de versión; no se puede resolver sólo con editar el literal `algorithm`.

## Decisiones v2 (MGC-477 spec v2, MGC-485 REQUEST_CHANGES)

### D1 — Cursor monotónico, `createRngFromSnapshot`
`createRngFromSnapshot(snapshot)` reconstruye una instancia `Mulberry32` con `seed = snapshot.seed` y avanza `cursor` exactamente 1 unidad por cada draw posterior. `snapshot.cursor` es **estrictamente creciente** en una sesión válida. Cualquier draw que intente decrementar el cursor debe lanzar `RngCursorError` (recuperable vía `restoreRng(defaultSeed)` + log a Sentry).

```ts
function createRngFromSnapshot(s: RngSnapshot): Rng {
  // cursor N → rng produce el (N+1)-ésimo valor y avanza a N+1
  return new Mulberry32(s.seed, initialCursor = s.cursor);
}
```

Reglas:
- `snapshot.cursor` post-draw = `snapshot.cursor + 1` (sin gaps).
- Draw de un valor negativo explícito del snapshot → error.
- `rngInt(min, max)` consume exactamente **1 draw** del cursor.

### D2 — `snapshotToSave` atómico
Cada `commitMatch` / `commitCopaRonda` persiste el `RngSnapshot` actualizado **en la misma transacción AsyncStorage** que el resto del `careerStore`. Sin escritura parcial: o se commitea todo o nada (rollback al snapshot previo). Implemented en `careerStore.commit()` (ver `src/features/career/store.ts`).

### D3 — `CopaBracket` consume snapshot
`CopaBracket.generate(seed, snapshot)` no llama `new Mulberry32(seed)` directo. Consume el `RngSnapshot` vigente vía `createRngFromSnapshot(snapshot)` y devuelve el snapshot actualizado. Esto garantiza que:
- El bracket es reproducible byte-a-byte desde el mismo snapshot.
- El bracket es reversible: rollback al snapshot anterior regenera el bracket idéntico.
- La copa no introduce randomness fuera del snapshot.

```ts
function generateBracket(
  seed: number,
  snapshot: RngSnapshot,
): { bracket: CopaRonda[][]; snapshot: RngSnapshot };
```

### D4 — Tiebreaker determinista (AC7)
`rngInt(0, 31)` con `RngSnapshot` vigente es el **último** criterio de desempate (post puntos, diferencia de gol, goles a favor). Sin `Math.random()` global. El draw se loguea en `careerStore.copaTiebreakerLog[]` con `{ matchId, snapshotCursor, value, decidedAt }` para auditoría.

### D5 — AC8 bloqueante de merge
Test `src/features/copero/copa.determinism.test.ts` ejecuta 100 iteraciones del flujo completo y compara el `RngSnapshot` final byte-a-byte. Sin este test verde, MGC-497 no mergea. Esta regla se enforce en CI gate `verify-copa-determinism`.
