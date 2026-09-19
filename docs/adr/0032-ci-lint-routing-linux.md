# ADR-0032 — Routing alternativo para `lint`/`typecheck`/`test-web` en CI

- **Status**: ADOPTED
- **Date**: 2026-09-19
- **Deciders**: devops (9e6c48fe) + CTO (04f696a8)
- **Aprobación**: CEO MGC-849 — Opción C = A principal + B respaldo (artifact cache + bump runner-01 a 2 GiB)
- **Supersedes**: ninguno (modifica la decisión parcial adoptada en ADR-0026 §4 que hoy enruta a `[self-hosted, macOS]`); mantener §4 hasta rollout completo de A+B
- **Superseded by**: —
- **Related**: MGC-636 (escalación runner-contention PR #661), MGC-632 (duplicate runner session fix, done), MGC-644 (cache-timeout 2min fix, done), MGC-2933 (swap thrash runner-01, decisión CEO MGC-2966 original), MGC-849 (CEO Opción C), MGC-852 (implementación A+B)

## Contexto

ADR-0026 separó runners por label. ADR-0026 §4 enruta `lint`/`typecheck`/`test-web`
a `[self-hosted, macOS]` para evitar swap thrash en runner-01 (VPS 954 MiB).
El driver fue la decisión CEO MGC-2966 Opción B: preferir el macOS local
(idle 8+ cores) sobre un bump de memoria en el VPS.

El 2026-09-18 ese enrutamiento provocó la cola de 1 h 44 min en PR #661
(MGC-636): runner-02b macOS quedó monopolizado por jobs `release-internal`
Android (los únicos que requieren macOS de verdad por Xcode/EAS), y el
job `lint` de PR #661 quedó sin runner mientras `runner-02` (id 3, macOS
legacy) y `runner-02b` (id 30) estaban ambos ocupados. PR #661 tampoco
podía mergear porque el gate CI verde (§8.1) requiere lint verde.

Inventario de runners observado el 2026-09-19 vía `gh api repos/mgcstudios/copero/actions/runners`:

| ID | Nombre | OS | Busy | Notas |
|----|--------|----|----|-------|
| 23 | copero-ci-runner-01-src | Linux | False | fork mgcstudios86/copero, inactivo |
| 27 | mac-mini-impostor-runner | macOS | False | repo impostor, no participa en copero |
| 29 | copero-ci-runner-01 | Linux | True | **VPS mgcstudios-01**, 954 MiB RAM, 6 GiB swap |
| 30 | copero-ci-runner-02b | macOS | True | **Mac del operador** (esta misma Mac) |

Estado de memoria en runner-01 vía SSH a `mgcstudios-deploy` (MGC-603 fix vigente):

```
               total        used        free   shared  buff/cache   available
Mem:           954Mi       613Mi        62Mi     13Mi       471Mi       340Mi
Swap:          6.0Gi       1.6Gi       4.4Gi
```

Wall-clock medido en serie (lint → typecheck → test-web, encadenado por
MGC-2934) sobre runner-02 macOS: ~28 min total cuando corre. Sobre
runner-01 Linux con `npm ci` clásico, en cambio, swap thrash + lease-zombie
lo dejan en estado `offline + busy=true` durante 1-3 h por run (MGC-2786,
MGC-2908, MGC-2912, MGC-2933, MGC-603). Por eso se eligió macOS como ruta
primaria.

El problema real no es la lentitud del macOS, sino que **macOS es ahora el
único pool que puede ejecutar `lint`/`typecheck`/`test-web`**, y ese pool
se comparte con:

1. **iOS release**: `eas build --local --platform ios` (macOS-only por Xcode).
2. **QA macOS**: Maestro iOS + Playwright web sobre Safari (macOS-only en parte).
3. **Android-internal**: `release-internal.yml` (corre en macOS por decisión heredada; podría correr en Linux sin degradación, pero hoy no).

Cuando cualquiera de los tres satura el runner macOS, la cola de CI
pendiente de merge se積滞 hasta varias horas. El bug de MGC-636 es
estructural: **enrutar CI pesada a un pool que se comparte con trabajo
no-CI es crear un SPOF de merge**, exactamente el patrón que ADR-0026
intentaba evitar para `copero-ci` vs `copero-qa` vs `copero-heavy`.

## Opciones evaluadas

### Opción A — Pre-warm `node_modules` con artifact cache (offline install)

Reemplazar `npm ci` por un artifact cache dedicado que contenga
`node_modules/` ya resuelto (sin lifecycle scripts). El workflow baja
el artifact (~80-120 MB), lo descomprime, salta `npm ci` por completo.

- **Pro**: el RSS durante `npm ci` (~600 MB pico en runner-01 por la
  combinación `node-gyp` + `metro` resolvers + caché `.npm`) desaparece
  del job. runner-01 puede correr lint sin swap thrash.
- **Pro**: estable en runner-01; cero dependencia de red durante el job.
- **Pro**: reutilizable para typecheck y test-web.
- **Contra**: artifact upload/download añade ~30-60 s de overhead por job.
- **Contra**: requiere mantener `actions/cache@v4` o `actions/upload-artifact@v4`
  con clave estable (`npm-${{ hashFiles('package-lock.json') }}`) y
  publicar el artifact pre-resuelto en cada bump de lockfile (job nocturno
  o pre-push hook). Esto añade un nuevo failure mode (lockfile bump
  sin republish → install vacío).
- **Contra**: el ciclo de bump de `package-lock.json` exige rebuild del
  artifact antes de que el primer PR con lock nuevo corra CI; ventana
  corta de cache miss (5-15 min).
- **Costo operativo**: bajo (solo GitHub storage). Sin costo monetario
  directo.
- **RSS esperado en runner-01**: ~150-200 MB (eslint + tsc + vitest sin
  install), bien dentro del presupuesto de 954 MiB. Sin swap thrash.

### Opción B — Bump memoria runner-01 a ≥ 2 GiB

Pedir al proveedor del VPS subir la asignación de RAM del runner-01 de
954 MiB a 2 GiB (o superior). El paquete inmediato del proveedor
(OPSI/Oracle/Linode según corresponda) es ~$4-6/mes extra.

- **Pro**: el más simple. Habilita todo en runner-01 sin re-arquitectura.
- **Pro**: el RSS multiplicativo de 4 jobs paralelos (1.6 GB virtual
  demand observado en MGC-2933) entra en presupuesto sin swap.
- **Contra**: la decisión CEO MGC-2966 Opción B fue rechazada a favor de
  macOS. Reabrir la decisión requiere justificativo nuevo: el SPOF de
  macOS (MGC-636) ES ese justificativo.
- **Contra**: si en el futuro se duplica el número de jobs paralelos o
  el codebase crece, el headroom vuelve a quedar corto.
- **Contra**: el costo mensual existe aunque el runner esté idle.
- **Costo**: ~$4-6/mes recurrentes. Decisión CEO.
- **RSS esperado en runner-01**: ~600 MB disponible para los 4 jobs
  serializados; pico de un solo job ~400 MB, sin swap thrash.

### Opción C — Routing `[self-hosted, copero-ci]` con `npm ci --prefer-offline --offline`

Volver al label pool `copero-ci` (cualquier runner que lo tenga) pero con
`--prefer-offline --offline` activado y un cache hit-rate target > 95%
(medido por MGC-2226).

- **Pro**: ningún cambio de runner ni de billing. Política de ADR-0026 §1
  sigue vigente (label `copero-ci` exclusivo).
- **Pro**: la pipeline encadenada MGC-2934 mantiene su estructura.
- **Contra**: si la cache命中率 cae < 95% (lockfile nuevo, dependencies
  bumpeadas) el swap thrash reaparece. Cache miss es binario en
  `--offline`: falla el job sin red de seguridad. **Esto es el riesgo
  operacional más alto de las cuatro opciones**.
- **Contra**: la métrica "cache hit-rate > 95%" requiere observabilidad
  nueva (script de telemetría por job). Hoy no existe.
- **Costo**: cero.
- **RSS esperado en runner-01**: idéntico a Opción A cuando cache hit;
  swap thrash completo cuando cache miss. **No es confiable**.

### Opción D — Runner Linux adicional (runner-02c) + sharding balanceador

Provisionar un segundo VPS Linux (mismo tamaño 954 MiB) etiquetado
`copero-ci`, y mover las jobs a `[self-hosted, copero-ci]` con sharding
round-robin (matriz de runners ya tiene id 23 = fork inactivo que se
puede re-etiquetar como runner dedicado CI).

- **Pro**: doble capacidad Linux para CI pesada.
- **Pro**: SPOF desaparece. runner-02b macOS deja de ser cuello de botella.
- **Contra**: provisioning de runner nuevo: ~30 min setup + 1 PR de infra
  + smoke test (MGC-2466 precedente). Costo mensual duplicado.
- **Contra**: el VPS adicional también es 954 MiB; **dos runners de 954 MiB
  no resuelven el swap thrash, solo lo duplican**. Si el problema base
  es RSS, la Opción D no lo arregla.
- **Contra**: re-etiquetar el runner id 23 del fork mgcstudios86/copero
  tiene riesgo cross-repo (ADR-0030 forbids cross-repo traffic sin
  waiver).
- **Costo**: ~$4-6/mes recurrentes adicionales.
- **RSS esperado en runner-01**: idéntico a Opción B sin bump. **Misma
  fragilidad que el problema base**.

## Benchmark RSS observado en runner-01

Medición snapshot 2026-09-19 23:14Z (VPS mgcstudios-01, SSH mgcstudios-deploy):

| Estado | RSS usado | Swap usado | Libre | Observaciones |
|--------|-----------|------------|-------|---------------|
| Idle (sin jobs) | 613 MiB | 1.6 GiB | 62 MiB | dockerd + 3 containerd-shim + Runner.Listener; el swap pre-existente es de arranques previos |
| Job `lint` ESLint (intento pasado) | > 1.4 GiB | > 4 GiB | < 0 | swap thrash → lease-zombie (MGC-2786) |
| Job `typecheck` tsc (intento pasado) | > 1.2 GiB | > 3.5 GiB | < 50 MiB | swap thrash → broker heartbeat fail (MGC-2908) |

Conclusión: cualquier opción que mantenga `npm ci` clásico en runner-01
reproduce el lease-zombie. La única vía confiable para correr CI pesada
en runner-01 sin swap thrash es **eliminar el pico de RSS durante install**
(Opción A) **o** aumentar la RAM por encima del pico (Opción B).

## Decisión propuesta

**Recomendación: Opción A (artifact cache pre-resuelto) como ruta principal;
Opción B (bump memoria a 2 GiB) como respaldo si Opción A no se aprueba o
falla el cache hit-rate sostenido durante 2 semanas.**

## Decisión CEO (2026-09-19, MGC-849)

**Aprobada Opción C (ambas combinadas)**: ejecutar A como ruta principal
sobre runner Linux, con B como respaldo inmediato para evitar OOM en el
primer cache miss (mientras `cache-hit-rate < 90%`).

- **Opción A** (artifact cache): `prep-node-modules.yml` nuevo en runner-01
  Linux; `ci.yml` lint/typecheck/test-web consume artifact y omite `npm ci`.
  Costo $0/mes recurrente.
- **Opción B** (bump 2 GiB): provisionar runner-01 VPS efímero de 954 MiB a
  2 GiB RAM. Costo estimado ≤ $6/mes. Cubre el failure mode de cache miss
  evitando el swap thrash (MGC-2786/2908/2912/2933).

Justificación de combinarlas: el failure mode de A (cache miss) reproduce
exactamente el problema que originó ADR-0026 §4. Sin B como red de
seguridad, el primer cache miss reverte A y nos devuelve al estado
anterior. B es estrictamente aditiva (más memoria, sin failure mode nuevo)
y permite medir A con datos limpios durante 2 semanas.

Razones:

1. **Costo**: Opción A no agrega billing recurrente. Opción B cuesta $4-6/mes
   permanentes.
2. **Riesgo operacional**: Opción A tiene un failure mode conocido (cache miss
   → swap thrash) que es el MISMO failure mode que ya tenemos, no uno nuevo.
   Opción B no tiene failure mode nuevo (es estrictamente más memoria).
3. **Compatibilidad**: Opción A es aditiva al workflow actual. Opción B
   también. Opción C requiere `--offline` que es binario y rompe el primer
   cache miss sin red de seguridad.
4. **Reversibilidad**: ambas se revierten con un PATCH al workflow.

Si CEO aprueba Opción A, la implementación es:

1. Workflow nuevo `prep-node-modules.yml` que corre en `[self-hosted,
   copero-ci, Linux]` cuando `package-lock.json` cambia en `main`.
   Pasos: `npm ci` + `actions/upload-artifact@v4` con key
   `node-modules-${{ hashFiles('package-lock.json') }}`, retention 7 días.
2. Modificar `ci.yml` `lint`/`typecheck`/`test-web`: descargar artifact
   `node-modules-*`, saltar `npm ci`, ajustar `PATH` para usar el
   `node_modules/.bin` resuelto.
3. Routing: volver a `[self-hosted, copero-ci]` (ADR-0026 §4 reemplazo).
4. Monitoreo: añadir métrica `cache-hit-rate` en runner-01 por job; si
   `< 90%` en 5 runs consecutivos, escalar a Opción B.

## Consecuencias

### Si se aprueba Opción A

- `lint`/`typecheck`/`test-web` vuelven a `runner-01` Linux.
- `runner-02b` macOS queda libre para iOS release + Android-internal +
  QA macOS, sin SPOF de merge.
- Riesgo residual: bump de `package-lock.json` sin re-publish del artifact
  → cache miss → swap thrash. Mitigación: el workflow de prep corre en
  cada push a `main` que toca el lock, ventana de miss < 5 min.

### Si se aprueba Opción B

- runner-01 con 2 GiB puede correr `lint`/`typecheck`/`test-web` serie
  sin swap thrash, manteniendo `npm ci` clásico.
- runner-02b macOS queda libre (mismo beneficio que Opción A).
- Costo $4-6/mes recurrentes. Sin cache miss risk.

### Si no se aprueba ninguna

- Política actual (`[self-hosted, macOS]`) se mantiene.
- Riesgo MGC-636 (cola de 1 h 44 min cuando macOS está monopolizado)
  se reproduce cada vez que un job macOS-only (iOS release, Android
  internal) coincide con un PR abierto.
- Sin budget para runner nuevo ni bump memoria. ADR queda como
  documentación histórica.

## Acceptance criteria de la PR infraestructura (MGC-852)

0. ADR-0032 mergeado a `main` con status=ADOPTED y SHA registrado.
1. Workflow `prep-node-modules.yml` agregado, con trigger `push:
   branches: [main]` + `paths: ['package-lock.json']`.
2. Artifact `node-modules-*` con retention 7 días, ~80-120 MB.
3. `ci.yml` `lint`/`typecheck`/`test-web` modificado para consumir
   el artifact en lugar de `npm ci`.
4. Routing `[self-hosted, copero-ci]` reemplazando
   `[self-hosted, macOS]` para los tres jobs.
5. `build-web` mantiene `[self-hosted, copero-ci]` (ya estaba así en
   ADR-0026).
6. runner-01 (Linux VPS) con memoria confirmada en 2 GiB (`free -m`
   reporta `Mem: 2048 MiB` o superior, swap no usado durante cold build).
7. Métrica `cache-hit-rate` expuesta vía job summary o artifact JSON.
8. Smoke test cold (sin cache): un PR representativo corre los tres
   jobs en runner-01 sin OOM/sigkill (RSS observado < 1.4 GiB,
   swap estable, sin `offline + busy=true` lease-zombie).
9. Smoke test warm (cache hit): el mismo PR corre en ≤ 50 % del
   wall-clock observado en baseline macOS-only (≤ 14 min serie).
10. Rollback: revert del PR → volver a `[self-hosted, macOS]` con
    `npm ci --prefer-offline` + revert bump memoria. Sin pasos manuales.
11. Costo mensual confirmado ≤ $6 USD (bump VPS efímero).