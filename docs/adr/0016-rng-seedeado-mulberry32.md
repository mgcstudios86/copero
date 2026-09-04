# ADR-0016: RNG seedeado — Mulberry32 propio

- Estado: Aceptado
- Fecha: 2026-09-04
- Ticket: MGC-1665
- Decisión técnica reversible

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
