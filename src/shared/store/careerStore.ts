// src/shared/store/careerStore.ts — Copero (MGC-227 persistencia + MGC-543 code-split)
//
// Store de Zustand para el state machine del simulador de carrera. MGC-543
// separa la lógica de identidad (liviana, sin motor) de las acciones de
// simulación (pesadas, requieren `engine.ts` → `simulation.ts` → `strategy.ts`).
//
// Persistencia (MGC-227): se delega a `features/career/persistence.ts` que
// expone `saveCareerSave/loadCareerSave/clearCareerSave` con payload
// versionado (`v: 1`) bajo la key `copero:career:save:v1` en AsyncStorage.
// Antes: la store usaba el middleware `zustand/persist` con key
// `copero-career`. Eso escribía un payload no versionado a una key distinta
// y generaba duplicación silenciosa con `saveCareerSave`. MGC-227 unifica:
// la store NO persiste automáticamente; cada acción llama
// `saveCareerSave(snapshot)` post-mutation, y `bootstrap` hidrata desde
// `loadCareerSave()` durante el arranque de la app.
//
// Acceptance criteria MGC-543: transfer /identity <= 415 KB. Esta refactor
// apunta a sacar ~120 KB de strategy+simulation+reputation del entry chunk.

import { AppState } from 'react-native';
import { create } from 'zustand';
import {
  initialSnapshot,
  isIdentityComplete,
} from '@/features/career/identity-state';
import {
  saveCareerSave,
  loadCareerSave,
  clearCareerSave,
  isPersistentStorage,
} from '@/features/career/persistence';
import { createRngSnapshot } from '@/features/career/rng';
import type { CareerAction } from '@/features/career/engine';
import type {
CareerSaveState,
CareerSaveV2,
  CareerSnapshot,
  Club,
  EstiloRasgo,
  Foot,
  Position,
  StrategyId,
  YearlyPlan,
} from '@/types/career';

type CareerStore = CareerSnapshot & {
  /**
   * MGC-306 AC4 — flag de hidratación completada. `false` durante el
   * bootstrap (entre mount del root layout y resolución de
   * `loadCareerSave`). `app/_layout.tsx` bloquea el render del Stack
   * hasta que sea `true` para evitar el flash de form identidad vacío
   * ("Apellido placeholder", "Dorsal 9 default") que QA reprodujo
   * post-force-stop. No se persiste (es state runtime del gate).
   */
  hydrated: boolean;
  setName: (name: string) => void;
  // MGC-1628 / WF1 — apellido separado del nombre. Mismo patrón que
  // `setName`: applyAndPersist spread inmutable, sin tocar motor.
  setLastName: (lastName: string) => void;
  // MGC-1628 / WF1 — edad editable en el form. El setter hace clamp
  // 16-35 (ver `setAge` en identity-state). La edad sigue siendo
  // mutable por el motor (season.ts la incrementa) — este setter sólo
  // opera en la pantalla de alta.
  setAge: (age: number) => void;
  setNumber: (number: number) => void;
  setPosition: (position: Position) => void;
  setNationality: (code: string) => void;
  /** MGC-955: setter de liga de origen (selector de identidad). */
  setLeague: (code: string) => void;
  setPreferredFoot: (foot: Foot) => void;
  commitIdentity: () => void;
  /**
   * MGC-249: ruta directa desde "Empezar carrera" al draft, sin pasar
   * por dashboard. Compone `commitIdentity` + `startDraft` en un solo step
   * para evitar dos renders intermedios con snapshot inconsistente.
   *
   * MGC-273: retorna `Promise<void>` y AWAITA `flushPendingSave()` al
   * final. Antes la acción disparaba la persistencia pero resolvía sin
   * esperar la confirmación de AsyncStorage — el caller (form
   * HomepageCareerStarter) hacía `router.push('/simulador-carrera/draft')`
   * inmediatamente, y un force-stop del usuario antes de que `setItem`
   * resolviera perdía el snapshot. La AC1/AC2 de MGC-270 fallaban con
   * home mostrando "Definí tu identidad" vacío tras relaunch. Await
   * bloquea la navegación hasta que AsyncStorage confirme la escritura.
   */
  commitIdentityAndStartDraft: (seed?: number) => Promise<void>;
  openAcademy: () => void;
  acceptClub: (club: Club) => void;
  /**
   * MGC-1648 — WF2 team-select obligatorio. Setea el club inicial del
   * jugador en el alta SIN cambiar de stage (queda en `dashboard`). La
   * pantalla /team-select se monta después de `commitIdentity` (stage ya
   * en `dashboard`), así que un transition extra a `clubStart` sacaría
   * al usuario del flujo de WF3 (hub de temporada). La persistencia es
   * async + await `flushPendingSave()` para que un `await caller.navigate()`
   * post-acción bloquee hasta que AsyncStorage confirme la escritura — el
   * mismo patrón AC7 de MGC-273 / MGC-284. Antes de MGC-1648 el club se
   * elegía dentro del academy (F2+ post-draft) y llegaba a `profile.club`
   * vía `acceptClub` + flujo `clubStart`. La ruta F1 obligatoria requiere
   * un setter independiente que no toque stage.
   */
  selectInitialClub: (club: Club) => Promise<void>;
  decide: (strategyId: StrategyId, choiceId: string) => void;
  /**
   * MGC-1017 — setYearlyPlan: persiste el plan anual elegido por el
   * usuario al cierre de la temporada. El engine lo consume en el
   * próximo `advanceSeason` (lo lee + resetea). Misma cadencia de
   * persistencia que `decide` para sobrevivir force-stop.
   */
  setYearlyPlan: (plan: YearlyPlan) => Promise<void>;
  /**
   * MGC-1505 — setEstilo: setter para los rasgos opt-in del jugador
   * (multi-select, cap 2). La UI pasa el array ya toggled; el reducer
   * re-sanitiza defensivamente (dedupe + cap 2 + descartar valores no
   * canónicos). Persistencia inmediata vía flushPendingSave para
   * sobrevivir force-stop, patrón idéntico a setYearlyPlan.
   */
  setEstilo: (rasgos: EstiloRasgo[]) => Promise<void>;
  /**
   * MGC-1657 (F2.3) — weeklyChoice dispara la decisión semanal V2
   * (`applyWeeklyChoice`). Persiste tras `flushPendingSave` para que el
   * snapshot con `positionStats` actualizado llegue a AsyncStorage.
   */
  weeklyChoice: (optionId: import('@/features/career/position-tree').WeeklyBaseOptionId) => Promise<void>;
  /**
   * MGC-1657 (F2.3) — resolveMatchweek cierra la matchweek
   * (`resolveWeeklyMatch` → `resolveMatch`). Suma goals + apps a
   * `profile.stats` y deja el resultado en `career.matchweekStats`.
   */
  resolveMatchweek: () => Promise<void>;
  /**
   * MGC-1650 (WF4) — startMatch: calcula el MatchOutcome y lo
   * deposita en matchStore (transient) sin tocar careerStore.
   */
  startMatch: () => Promise<void>;
  /**
   * MGC-1650 (WF5) — commitMatch: aplica el nextProfile del
   * matchStore al careerStore, avanza la semana y persiste.
   */
  commitMatch: () => Promise<void>;
  /**
   * MGC-1650 (WF5) — discardMatch: resetea matchStore sin tocar
   * careerStore (botón «Volver al hub»).
   */
  discardMatch: () => void;
  advance: () => void;
  /**
   * Draft de leyendas (MGC-208 §1) — MGC-209.
   *
   * MGC-284: todas las acciones del draft/post-draft retornan `Promise<void>`
   * y AWAITAN `flushPendingSave()` antes de resolver. Antes eran fire-and-
   * forget (`void (async () => {...})()`) — el snapshot quedaba en memoria
   * pero un force-stop antes de que `setItem` resolviera lo perdía.
   *
   * Concretamente: tras `pickLegend`/`swapLegend`/`pickClub`/`advanceSeason`,
   * si el usuario force-stopea antes del flush, AsyncStorage queda con un
   * snapshot anterior y al relaunch la home mostraba onboarding vacío
   * (AC1) o la pantalla de draft sin las picks confirmadas (AC4).
   *
   * El await interno serializa el chain (las saves encadenadas vía
   * `pendingSave` de MGC-277 ya garantizan ordenamiento) y bloquea hasta
   * que `setItem` confirme la escritura. Los callers pueden ignorar el
   * return value (Button.onPress lo descarta), pero si navegan justo
   * después deben `await` para estar seguros — patrón idéntico al de
   * `commitIdentityAndStartDraft` (MGC-273) en HomepageCareerStarter.
   */
  startDraft: (seed?: number) => Promise<void>;
  swapLegend: () => Promise<void>;
  pickLegend: () => Promise<void>;
  /** Selector de club post-draft (MGC-208 §2). */
  pickClub: (club: Club) => Promise<void>;
  /** Loop anual (MGC-208 §3). */
  advanceSeason: () => Promise<void>;
  runCareerToRetirement: () => Promise<void>;
  /**
   * MGC-1802 P1-7 — retiro temprano. Antes de llegar a
   * `RETIREMENT_AGE = 34` (MGC-208 §3), el usuario puede cerrar la
   * carrera YA. Setea stage='retirement' sin correr el motor; el log
   * y profile actuales se preservan para que `fin-carrera.tsx`
   * renderice el resumen con los datos parciales (sin esperar 38
   * semanas). El walk MGC-1739 catalogó "WF6 fin-carrera bloquea
   * retiro si carrera <38 sem — no permite retiro temprano".
   */
  retireEarly: () => Promise<void>;
  /** MGC-1730 (HIGH-1 fix sobre PR #425) — drena `postMatchPending`
   * después de que la UI F3.3 mostró el modal post-partido. Persiste
   * inmediatamente para sobrevivir force-stop. */
  clearPostMatch: () => Promise<void>;
  /** MGC-1730 (HIGH-1 fix sobre PR #425) — resuelve el transfer system
   * con el id aceptado o `null` (declinar todas). Sin efecto si no hay
   * `transferState` abierto (temporada sin cierre reciente). */
  resolveTransfer: (acceptedOfferId: string | null) => Promise<void>;
  /** MGC-227: hidrata la store desde AsyncStorage vía `loadCareerSave`.
   * Llamado una vez durante el bootstrap de la app (`app/_layout.tsx`).
   * Devuelve `true` si encontró un save previo y lo aplicó. */
  hydrateFromSave: () => Promise<boolean>;
  reset: () => void;
  /**
   * MGC-1736 (WF6) — reset destructivo AWAITABLE para el CTA
   * "Nueva carrera" en `fin-carrera.tsx`. A diferencia de `reset()`
   * (fire-and-forget), drena `flushPendingSave()` ANTES del clear para
   * que una save en vuelo no reescriba la carrera vieja después del
   * `clearCareerSave` (datos fantasma del AC de no-mutación), y AWAITA
   * el borrado de AsyncStorage antes de resolver, para que el caller
   * navegue a `/identity` con el disco ya vacío.
   */
  resetAll: () => Promise<void>;
  // MGC-1802 P0-5 — sale del estado retirement y vuelve a season sin
  // reiniciar la carrera. Persistido por applyAndPersist.
  resumeFromRetirement: () => Promise<void>;
};

/**
* Snapshot persistible (alineado con `CareerSaveState` salvo `clubId`,
 * que la store no expone — `profile.club.id` lo cubre). Lo construimos
 * desde el estado actual de la store en cada save.
 *
 * MGC-1628 rev 3 §L2: `snapshotToSave` retorna shape `v: 1` para no
 * romper las saves legacy en disco. La conversión al shape `v: 2`
 * ocurre en `getSnapshot()` (helper público), que además normaliza el
 * `Injury` con `affectedAttr`/`startedAtWeek` para los callers que
 * quieran consumir el snapshot sin pasar por `loadCareerSave`.
 */
function snapshotToSave(s: CareerStore): CareerSaveState {
  return {
    v: 1,
    stage: s.stage,
    profile: s.profile,
    draft: s.draft ?? null,
    card: s.card ?? null,
    clubId: s.profile.club ? s.profile.club.id : null,
    log: s.log ?? { timeline: [], events: [] },
    seed: s.seed ?? 0,
    rng: s.rng ?? createRngSnapshot(s.seed ?? 0),
    // MGC-1730 (HIGH-2 fix sobre PR #425) — persistir los 3 campos F3.2
    // para que sobrevivan force-stop. Los defaults los aplica
    // `loadCareerSave` (ver `persistence.ts#hydrateF3Fields`); acá sólo
    // copiamos lo que está en memoria (puede ser `null`/`undefined` y
    // es válido — el loader los normaliza).
    postMatchPending: s.postMatchPending ?? null,
    nextWeekModifiers: s.nextWeekModifiers,
    transferState: s.transferState ?? null,
  };
}

/**
 * MGC-1628 rev 3 §L2 — `getSnapshot(): CareerSaveV2`.
 *
 * Helper público que toma el estado actual de la store y lo proyecta al
 * shape `v: 2`. Casos de uso:
 *
 * - Tests E2E que necesitan un snapshot completo sin pasar por el
 *   ciclo `saveCareerSave` → `loadCareerSave`.
 * - Debug / telemetry: exponer el snapshot vía `Sentry` o el panel de
 *   QA sin filtrar estado runtime (`hydrated`, setters).
 * - Migración on-the-fly V1→V2 para clientes que aún tienen saves v1.
 *
 * Es función pura: no muta la store, no llama a AsyncStorage, no
 * dispara listeners. Vinculada a `commit()` (cada save v2 emite este
 * shape) y a `loadCareerSave()` (v1 legacy se normaliza vía
 * `migrateV1ToV2` antes de hidratar la store).
 */
export function getSnapshot(): CareerSaveV2 {
  const s = useCareerStore.getState();
  return {
    v: 2,
    stage: s.stage,
    profile: s.profile,
    draft: s.draft ?? null,
    card: s.card ?? null,
    clubId: s.profile.club ? s.profile.club.id : null,
    log: s.log ?? { timeline: [], events: [] },
    seed: s.seed ?? 0,
    // MGC-1730 (HIGH-1 fix sobre PR #425) — exponer los 3 campos F3.2
    // también en `getSnapshot` para que tests E2E / telemetry vean el
    // shape completo sin pasar por save/load.
    postMatchPending: s.postMatchPending ?? null,
    nextWeekModifiers: s.nextWeekModifiers,
    transferState: s.transferState ?? null,
  };
}

/**
 * MGC-257 — handle a la save en curso (o la última). Se reusa entre
 * mutaciones: una nueva save espera a que termine la anterior (evita
 * race en `setItem`) y queda registrada para que un listener
 * `AppState` en `_layout.tsx` la pueda drenar antes de background
 * (revivir tras force-stop / kill OS). Antes era fire-and-forget: el
 * snapshot podía no llegar a disco si el proceso moría antes de que
 * `AsyncStorage.setItem` resolviera (AC7).
 */
let pendingSave: Promise<void> | null = null;

export function getPendingSave(): Promise<void> | null {
  return pendingSave;
}

/**
 * MGC-257 — drena la save pendiente. Llamado por el listener
 * `AppState` en `_layout.tsx` cuando el OS manda la app a background
 * (al briefcase switch, lockscreen, o force-stop inminente). Devuelve
 * la promesa resuelta cuando AsyncStorage confirmó la escritura, así
 * el snapshot queda en disco antes de que el proceso muera.
 */
export function flushPendingSave(): Promise<void> {
  if (!pendingSave) return Promise.resolve();
  return pendingSave;
}

/**
 * MGC-363 — `lastSnapshot` es el snapshot persistible más reciente del
 * store. Se mantiene sincronizado con cada mutación vía un `subscribe`
 * que corre al cargar este módulo (abajo). Es independiente de
 * `pendingSave`: aunque la cadena de promesas esté en vuelo o vacía,
 * `lastSnapshot` refleja el estado actual del store y se puede volcar
 * a disco síncronamente desde el listener de `AppState`.
 *
 * Belt-and-suspenders sobre el fix de PR #155 (`require` estático +
 * `flushPendingSave` en cada acción): si por algún motivo una save
 * encadenada queda huérfana (re-render que descarta la promesa, race
 * entre `setItem` y un kill inmediato del proceso, o un setXxx
 * fire-and-forget del form de identidad que nunca llega al
 * `flushPendingSave` final), el listener de AppState escribe el
 * último snapshot conocido sin depender de la cadena de promesas.
 */
type SnapshotPayload = CareerSaveState;
let lastSnapshot: SnapshotPayload | null = null;

export function getLastSnapshot(): SnapshotPayload | null {
  return lastSnapshot;
}

/**
 * MGC-363 — escribe `lastSnapshot` directo a AsyncStorage sin pasar por
 * `pendingSave`. Llamado por el listener de `AppState` registrado a
 * nivel módulo (abajo). Es best-effort: si AsyncStorage falla, el
 * `catch` silencia (el listener de MGC-257 + `flushPendingSave` siguen
 * siendo la red de seguridad principal).
 */
async function writeLastSnapshotToDisk(): Promise<void> {
  if (!lastSnapshot) return;
  try {
    await saveCareerSave(lastSnapshot);
  } catch {
    // best-effort: el listener ya hizo su parte; el próximo
    // `flushPendingSave` o el `await` post-acción cubren el gap.
  }
}

/**
 * Persiste el snapshot actual encadenando la promesa en `pendingSave`
 * para que (a) llamadas concurrentes no pisen `setItem` y (b) un
 * `AppState` listener en `_layout.tsx` pueda esperar la escritura
 * completa antes de background. Errores de AsyncStorage (quota, red
 * en web fallback) no rompen la mutación de la store; la UI sigue
 * funcionando y el próximo save reintenta.
 */
function persistSnapshot(s: CareerStore): void {
  const next = saveCareerSave(snapshotToSave(s)).catch(() => {
    // Silencioso: persistencia best-effort. Loguear en QA si aparece
    // recurrentemente (hoy no hay logger central).
  });
  // MGC-277 review CTO: capturar la promesa compuesta en una variable
  // local para que la comparación de identidad (===) cierre
  // correctamente cuando hay saves encadenadas. Antes, `pendingSave`
  // apuntaba a la promesa compuesta en la segunda/tercera/... llamada
  // y `pendingSave === next` siempre era `false` — la cadena crecía
  // sin límite durante la sesión y `flushPendingSave()` terminaba
  // awaiteando toda la historia de saves en el path crítico del
  // force-stop (AC7).
  const chained = pendingSave ? pendingSave.then(() => next) : next;
  pendingSave = chained;
  void chained.finally(() => {
    if (pendingSave === chained) pendingSave = null;
  });
}

/**
 * MGC-421 AC7 — C1 atomic save gate (helper).
 *
 * Patrón canónico para mutaciones terminales: encadena el snapshot
 * actual en `pendingSave` Y espera la confirmación de AsyncStorage
 * antes de resolver. Garantiza que un `await caller.navigate()` no
 * ocurra antes de que `setItem` haya escrito a disco, evitando la
 * condición de carrera que 5 PRs previos (MGC-262/273/284/311 +
 * MGC-306) no cerraron (force-stop post-mutación perdía el snapshot).
 *
 * Usar en: `commitIdentityAndStartDraft`, `acceptClub`,
 * `runCareerToRetirement`, `advanceSeason` cuando `season >= 8`
 * (cierre de loop al retirement). Para mutaciones no terminales
 * (setters de identity, decide, advance, swapLegend, pickLegend,
 * pickClub) sigue siendo válido el patrón `persistSnapshot(get())`
 * sin await — la navegación post-step es local al dashboard y el
 * listener `AppState` (MGC-363) cubre la persistencia en background.
 */
export function persistAndFlush(s: CareerStore): Promise<void> {
  persistSnapshot(s);
  return flushPendingSave();
}

export const useCareerStore = create<CareerStore>()((set, get) => {
  // Adaptador para que `set((s) => ...)` siga funcionando con la firma
  // original de Zustand en la creación del store. Zustand set acepta
  // `(state: CareerStore) => CareerStore`, pero la lógica del simulador
  // trabaja sobre `CareerSnapshot` (sub-tipo). Forzamos vía `unknown`.
  const setSnapshot = (fn: (s: CareerSnapshot) => CareerSnapshot) =>
    set(fn as unknown as Parameters<typeof set>[0]);

  /** Helper: aplica una mutación al snapshot y persiste. */
  const applyAndPersist = (fn: (s: CareerSnapshot) => CareerSnapshot) => {
    setSnapshot(fn);
    persistSnapshot(get());
  };

  return {
    ...initialSnapshot(),
    // MGC-306 AC4: arrancamos en `false` para que `app/_layout.tsx`
    // muestre el gate (splash neutro, sin form ni CTA) hasta que
    // `hydrateFromSave()` resuelva. Se flippea a `true` al final del
    // action — éxito, vacío, o error, todos garantizan progreso.
    hydrated: false,
    // Setters livianos: identity-state, sin motor.
    setName: (name) => applyAndPersist((s) => ({ ...s, profile: { ...s.profile, name } })),
    // MGC-1628 / WF1 — apellido separado. Persiste junto al resto del
    // profile; back-compat con saves v:1/v:2 (lastName undefined → '').
    setLastName: (lastName) =>
      applyAndPersist((s) => ({ ...s, profile: { ...s.profile, lastName } })),
    // MGC-1628 / WF1 — edad editable. El clamp 16-35 vive en
    // identity-state.setAge (single source of truth); acá sólo
    // aplicamos el spread.
    setAge: (age) => applyAndPersist((s) => ({ ...s, profile: { ...s.profile, age } })),
    setNumber: (number) =>
      applyAndPersist((s) => ({ ...s, profile: { ...s.profile, number } })),
    setPosition: (position) =>
      applyAndPersist((s) => ({ ...s, profile: { ...s.profile, position } })),
    setNationality: (code) =>
      applyAndPersist((s) => ({ ...s, profile: { ...s.profile, nationalityCode: code } })),
    // MGC-955: setter liviano, mismo patrón que setNationality. Persiste
    // junto al resto del profile; el avance a dashboard lo arrastra.
    setLeague: (code) =>
      applyAndPersist((s) => ({ ...s, profile: { ...s.profile, leagueCode: code } })),
    setPreferredFoot: (foot) =>
      applyAndPersist((s) => ({ ...s, profile: { ...s.profile, preferredFoot: foot } })),
    // Transiciones de stage: pure helpers sin motor. Síncronas para
    // preservar el patrón `commitIdentity(); router.push('/dashboard')`
    // existente en identity.tsx, dashboard.tsx y academy.tsx.
    commitIdentity: () =>
      applyAndPersist((s) => ({ ...s, stage: 'dashboard' as const })),
    // MGC-249: combinamos commitIdentity + startDraft en un solo step para
    // garantizar atomicidad del snapshot persistido (no hay frame intermedio
    // con stage='dashboard' y sin draft que dispararía el bug original).
    // MGC-273: la acción ahora retorna la Promise del IIFE y AWAITA
    // `flushPendingSave()` antes de resolver. Ver rationale en el type
    // declaration arriba (AC1/AC2 MGC-270 — force-stop inmediato tras
    // "Empezar carrera" perdía el snapshot porque la persistencia quedaba
    // en vuelo).
    commitIdentityAndStartDraft: async (seed) => {
      const { step } = await import('@/features/career/engine');
      setSnapshot((s) =>
        step(s, { type: 'commitIdentityAndDraft', seed } satisfies CareerAction),
      );
      persistSnapshot(get());
      await flushPendingSave();
    },
    openAcademy: () =>
      applyAndPersist((s) => ({ ...s, stage: 'academy' as const })),
    acceptClub: (club) =>
      applyAndPersist((s) => ({
        ...s,
        stage: 'clubStart' as const,
        profile: {
          ...s.profile,
          club: club,
          clubPresupuesto: club.presupuesto,
          clubInteres: true,
        },
      })),
    // MGC-1648 — WF2 team-select obligatorio. Setea club + presupuesto +
    // interes sin tocar stage (la pantalla /team-select llega cuando
    // stage ya está en `dashboard` post `commitIdentity`). Persistencia
    // async + flushPendingSave para que el `router.replace('/dashboard')`
    // posterior bloquee hasta que AsyncStorage confirme la escritura.
    selectInitialClub: async (club) => {
      setSnapshot((s) => ({
        ...s,
        profile: {
          ...s.profile,
          club,
          clubPresupuesto: club.presupuesto,
          clubInteres: true,
        },
      }));
      persistSnapshot(get());
      await flushPendingSave();
    },
    // MGC-1802 P0-5 — 'Volver a la temporada' desde fin-carrera.
    // El usuario tapó 'Retirarme' o llegó a retiro por edad y desde el
    // resumen quiere revisar la última temporada sin reiniciar la carrera.
    // Sin este setter, `router.replace('/temporada')` es seguido
    // inmediatamente por un redirect de vuelta a `/fin-carrera` en el
    // useEffect de temporada.tsx (stage==='retirement').
    resumeFromRetirement: async () => {
      applyAndPersist((s) =>
        s.stage === 'retirement' ? { ...s, stage: 'season' as const } : s,
      );
    },
    // Acciones de simulación: dynamic import del engine. La navegación
    // ya ocurrió (la UI está en /dashboard), así que el update
    // asincrónico no rompe el flujo de pantalla.
    // MGC-284: ahora async + await flushPendingSave() para que cada
    // step del simulador bloquee hasta que AsyncStorage confirme la
    // escritura — antes fire-and-forget perdía el snapshot post
    // force-stop (AC4 — 8 rounds + force-stop).
    decide: async (strategyId, choiceId) => {
      const { step } = await import('@/features/career/engine');
      setSnapshot((s) =>
        step(s, { type: 'decide', strategyId, choiceId } satisfies CareerAction),
      );
      persistSnapshot(get());
      await flushPendingSave();
    },
    // MGC-1657 (F2.3) — decisión semanal V2. Dispatchea el action
    // `weeklyChoice` que el reducer conecta con `applyWeeklyChoice` (motor
    // puro F2.3). Persistencia idéntica a `decide` (await
    // flushPendingSave) para sobrevivir force-stop.
    weeklyChoice: async (optionId) => {
      const { step } = await import('@/features/career/engine');
      setSnapshot((s) =>
        step(s, { type: 'weeklyChoice', optionId } satisfies CareerAction),
      );
      persistSnapshot(get());
      await flushPendingSave();
    },
    // MGC-1657 (F2.3) — invocación de `resolveMatch` al cierre de la
    // matchweek. La UI semanal lo llama después del weekly choice de
    // tipo partido. Acumula goals + apps en `profile.stats`.
    resolveMatchweek: async () => {
      const { step } = await import('@/features/career/engine');
      setSnapshot((s) =>
        step(s, { type: 'resolveMatchweek' } satisfies CareerAction),
      );
      persistSnapshot(get());
      await flushPendingSave();
    },
    // MGC-1650 (WF4 + WF5 partido y post-partido). El flujo de 3
    // pantallas usa `matchStore` (transient) como buffer; este par de
    // acciones maneja el ciclo de vida.
    startMatch: async () => {
      const { resolveWeeklyMatch } = await import('@/features/career/simulation');
      const {
        ratingFromOutcome,
        deltasFromRating,
        clampCareerStat,
      } = await import('@/features/career/match');
      const { useMatchStore } = await import('@/shared/store/matchStore');
      const current = get().profile;
      const { profile: nextProfile, match } = resolveWeeklyMatch(current);
      const rating = ratingFromOutcome(match);
      const { moralDelta, fisicoDelta, confianzaDelta } =
        deltasFromRating(rating);
      const preview = {
        rating,
        moralDelta,
        fisicoDelta,
        confianzaDelta,
        reputationChanged: false,
        cleanSheet: match.cleanSheet,
        goals: match.goals,
        score: match.score,
      };
      const previewedProfile = {
        ...nextProfile,
        career: {
          ...nextProfile.career,
          moral: clampCareerStat(nextProfile.career.moral + moralDelta),
          fisico: clampCareerStat(nextProfile.career.fisico + fisicoDelta),
          confianza: clampCareerStat(
            nextProfile.career.confianza + confianzaDelta,
          ),
        },
      };
      useMatchStore.getState().setMatch({
        outcome: match,
        previousProfile: current,
        nextProfile: previewedProfile,
        preview,
      });
    },
    commitMatch: async () => {
      const { useMatchStore } = await import('@/shared/store/matchStore');
      const { advanceWeek } = await import('@/features/career/simulation');
      const ms = useMatchStore.getState();
      if (!ms.outcome || !ms.nextProfile) {
        useMatchStore.getState().reset();
        return;
      }
      setSnapshot((s) => ({
        ...s,
        profile: ms.nextProfile!,
      }));
      const advanced = advanceWeek(ms.nextProfile!);
      setSnapshot((s) => ({ ...s, profile: advanced }));
      persistSnapshot(get());
      await flushPendingSave();
      ms.commit();
    },
    discardMatch: () => {
      void import('@/shared/store/matchStore').then((m) =>
        m.useMatchStore.getState().reset(),
      );
    },
    setYearlyPlan: async (plan) => {
      const { step } = await import('@/features/career/engine');
      setSnapshot((s) =>
        step(s, { type: 'setYearlyPlan', plan } satisfies CareerAction),
      );
      persistSnapshot(get());
      await flushPendingSave();
    },
    // MGC-1505: setter de rasgos (multi-select, cap 2 enforced en reducer).
    // Misma cadencia async + await flushPendingSave que setYearlyPlan para
    // sobrevivir force-stop (AC persistence gate).
    setEstilo: async (rasgos) => {
      const { step } = await import('@/features/career/engine');
      setSnapshot((s) =>
        step(s, { type: 'setEstilo', rasgos } satisfies CareerAction),
      );
      persistSnapshot(get());
      await flushPendingSave();
    },
    advance: async () => {
      const { step } = await import('@/features/career/engine');
      setSnapshot((s) => step(s, { type: 'advance' } satisfies CareerAction));
      persistSnapshot(get());
      await flushPendingSave();
    },
    // MGC-209: acciones del draft + loop anual + selector de club.
    // MGC-284: ahora async + await flushPendingSave — antes fire-and-
    // forget. Ver rationale en el type declaration arriba.
    startDraft: async (seed) => {
      const { step } = await import('@/features/career/engine');
      setSnapshot((s) =>
        step(s, { type: 'startDraft', seed } satisfies CareerAction),
      );
      persistSnapshot(get());
      await flushPendingSave();
    },
    swapLegend: async () => {
      const { step } = await import('@/features/career/engine');
      setSnapshot((s) => step(s, { type: 'swapLegend' } satisfies CareerAction));
      persistSnapshot(get());
      await flushPendingSave();
    },
    pickLegend: async () => {
      const { step } = await import('@/features/career/engine');
      setSnapshot((s) => step(s, { type: 'pickLegend' } satisfies CareerAction));
      persistSnapshot(get());
      await flushPendingSave();
    },
    pickClub: async (club) => {
      const { step } = await import('@/features/career/engine');
      setSnapshot((s) => step(s, { type: 'pickClub', club } satisfies CareerAction));
      persistSnapshot(get());
      await flushPendingSave();
    },
    advanceSeason: async () => {
      const { step } = await import('@/features/career/engine');
      // MGC-421 AC7 — C1 atomic save gate con guard explícito de
      // cierre de loop: si la temporada actual es >= 8, estamos
      // cerca del cierre del loop carrera→retiro (el simulador
      // corre ~17 seasons hasta `RETIREMENT_AGE = 34`). El flush
      // sincrónico protege contra force-stop entre la última
      // season y la pantalla retirement — escenario que 5 PRs
      // previos no cerraron.
      const isClosingLoop = get().profile.season >= 8;
      setSnapshot((s) =>
        step(s, { type: 'advanceSeason' } satisfies CareerAction),
      );
      if (isClosingLoop) {
        await persistAndFlush(get());
      } else {
        persistSnapshot(get());
        await flushPendingSave();
      }
    },
    runCareerToRetirement: async () => {
      const { step } = await import('@/features/career/engine');
      setSnapshot((s) =>
        step(s, { type: 'runCareerToRetirement' } satisfies CareerAction),
      );
      // MGC-257 (AC7) — esta transición es el último step del flow y
      // el que estaba perdiéndose tras force-stop: el snapshot
      // quedaba en memoria pero `setItem` no resolvía antes de que
      // el proceso muriera. Forzamos un flush sincrónico del handle
      // pendingSave para que el `stage: 'retirement'` + log final
      // queden en AsyncStorage antes de que el usuario salga de la
      // pantalla.
      await persistAndFlush(get());
    },
    // MGC-1802 P1-7 — retiro temprano. Setea stage='retirement' sin
    // correr el motor. Log y profile parciales quedan tal cual para
    // que fin-carrera pinte el resumen. Persistencia con flush (mismo
    // patrón que runCareerToRetirement) para sobrevivir force-stop.
    retireEarly: async () => {
      setSnapshot((s) =>
        s.stage === 'retirement' ? s : { ...s, stage: 'retirement' as const },
      );
      await persistAndFlush(get());
    },
    // MGC-1730 (HIGH-1 fix sobre PR #425) — drena el modal post-partido.
    // Misma cadencia que `setEstilo` (async + await flush) para que el
    // snapshot sin `postMatchPending` llegue a disco.
    clearPostMatch: async () => {
      const { step } = await import('@/features/career/engine');
      setSnapshot((s) => step(s, { type: 'clearPostMatch' } satisfies CareerAction));
      persistSnapshot(get());
      await flushPendingSave();
    },
    // MGC-1730 (HIGH-1 fix sobre PR #425) — resuelve el transfer system.
    // `null` declina todas las ofertas (`declineAllOffers` en el reducer);
    // un `offerId` válido lo acepta y la UI F3.3 puede mover al jugador
    // de club.
    resolveTransfer: async (acceptedOfferId) => {
      const { step } = await import('@/features/career/engine');
      setSnapshot((s) =>
        step(s, { type: 'resolveTransfer', acceptedOfferId } satisfies CareerAction),
      );
      persistSnapshot(get());
      await flushPendingSave();
    },
    // MGC-227: hidratación desde AsyncStorage. Llamado una vez en el
    // bootstrap de la app (ver `app/_layout.native.tsx` + `_layout.web.tsx`).
    // Aplica el save al estado actual; si no hay save, devuelve `false`
    // y deja el initial. MGC-259: envolvemos `loadCareerSave` en try/catch
    // para que el `hydrateGate` en `_layout.*.tsx` SIEMPRE desbloquee
    // (un save corrupto o AsyncStorage roto no debe dejar la UI colgada
    // en el splash).
    hydrateFromSave: async () => {
      let saved;
      try {
        saved = await loadCareerSave();
      } catch {
        // MGC-306 AC4: incluso si AsyncStorage explota, flippeamos
        // `hydrated` para destrabar el gate del layout. El usuario
        // sigue pudiendo usar la app con initialSnapshot; la próxima
        // save sobrescribirá cualquier estado corrupto.
        set((s) => ({ ...s, hydrated: true }));
        return false;
      }
      if (!saved) {
        set((s) => ({ ...s, hydrated: true }));
        return false;
      }
      setSnapshot((s) => ({
        ...s,
        stage: saved.stage,
        profile: saved.profile,
        draft: saved.draft ?? null,
        card: saved.card ?? null,
        log: saved.log,
        seed: saved.seed,
        rng: saved.rng,
        // MGC-1730 (HIGH-2 fix sobre PR #425) — copiar los 3 campos F3.2
        // del save al store. `loadCareerSave` ya aplicó
        // `hydrateF3Fields`, así que vienen con defaults si eran
        // `undefined` en disco.
        postMatchPending: saved.postMatchPending ?? null,
        nextWeekModifiers: saved.nextWeekModifiers,
        transferState: saved.transferState ?? null,
      }));
      set((s) => ({ ...s, hydrated: true }));
      return true;
    },
    // reset: estado inicial sin motor. Borra el save persistido.
    reset: () => {
      setSnapshot(() => initialSnapshot());
      void clearCareerSave().catch(() => {
        // best-effort: si falla el clear, el próximo save sobrescribe.
      });
    },
    // MGC-1736 (WF6) — variant awaitable de reset. Ordena:
    //   1) flushPendingSave: drena la save en vuelo al disco para
    //      que NO compita con el clear siguiente.
    //   2) reset memoria: vuelve al initialSnapshot.
    //   3) await clearCareerSave: borra la entry de AsyncStorage y
    //      ESPERA a que termine antes de resolver, así el caller
    //      (CTA "Nueva carrera") navega con disco vacío.
    // El `try/catch` alrededor de clearCareerSave es best-effort
    // (idéntico a `reset()`): si falla el clear, el próximo save
    // sobrescribe; pero el flush previo igual cierra la ventana de
    // datos fantasma que el AC de no-mutación prohíbe.
    resetAll: async () => {
      try {
        await flushPendingSave();
      } catch {
        // best-effort: si flush falla seguimos con el reset memoria
        // y el clear; el peor caso es la misma ventana que reset().
      }
      setSnapshot(() => initialSnapshot());
      await clearCareerSave().catch(() => {
        // best-effort: si falla el clear, el próximo save sobrescribe.
      });
    },
  };
});

/** Snapshot del estado sin suscribirse a cambios (helper para tests). */
export const getCareerSnapshot = (): CareerSnapshot => {
  const s = useCareerStore.getState();
  return { stage: s.stage, profile: s.profile };
};

export { isIdentityComplete };

/**
 * MGC-363 — bootstrap de la red de seguridad de persistencia. Se ejecuta
 * al cargar el módulo `careerStore.ts` (la primera vez que cualquier
 * parte de la app importa el store), antes de que React monte el root
 * layout. Hace tres cosas:
 *
 * 1. Sincroniza `lastSnapshot` con cada mutación del store vía
 *    `useCareerStore.subscribe`. Zustand dispara el listener después
 *    de cada `set(...)` exitoso, así que `lastSnapshot` queda alineado
 *    con el estado autoritativo del store antes de que cualquier
 *    `await` o navegación pueda sacarnos del proceso (force-stop).
 *
 * 2. Registra un listener de `AppState` a nivel módulo. Antes vivía en
 *    `_layout.tsx` y se ataba al ciclo de vida del componente ThemedShell
 *    — si React todavía no había montado (gate hidratando) o ya se había
 *    desmontado (HMR / fast-refresh), el listener desaparecía. A nivel
 *    módulo corre durante toda la vida del JS bundle. El listener
 *    dispara cuando el OS pasa la app a background o inactive
 *    (lockscreen, briefcase switch, o force-stop inminente vía OS
 *    pressure), vuelca `lastSnapshot` a disco y drena la cadena
 *    `pendingSave` pendiente. Es best-effort: si el proceso muere antes
 *    de que `setItem` resuelva, al menos la save anterior (capturada
 *    por `lastSnapshot`) está viajando a disco.
 *
 * 3. Loguea un warning si AsyncStorage cayó al fallback de memoria. Eso
 *    indica que `pickStorage()` no resolvió `@react-native-async-storage/async-storage`
 *    (Metro/Hermes), y todo `saveCareerSave` queda en RAM — el force-stop
 *    perdería la partida sin este warning. Visible en `adb logcat | grep
 *    copero:career`.
 *
 * Idempotente: si por algún motivo el módulo se importa dos veces
 * (HMR, tests), reutilizamos `appStateListenerInstalled` como guard.
 *
 * Nota técnica: `AppState` y `console` se acceden directo (sin guard
 * `typeof X === 'undefined'`) porque `react-native` exporta un mock
 * estable para Node (vitest) y un binding real para el runtime RN.
 * El guard con `typeof` rompía el SSR transform de Rollup en vitest
 * (parse error "Expected 'from', got 'typeOf'" porque el compilador
 * de SSR trata el bloque como código de usuario y no strip-ea el
 * operador TS-only).
 */

/**
 * MGC-363 — bootstrap lazy. La función se ejecuta la primera vez que
 * React monta el árbol (vía `bootstrapPersistence()` invocada desde
 * `app/_layout.tsx`). ANTES el listener se ataba al ciclo de vida del
 * componente ThemedShell y desaparecía en HMR o antes del mount — el
 * OS mandaba la app a background antes de que React registrara el
 * useEffect, perdiendo la save. AHORA corre en cuanto el primer import
 * del store resuelve, garantizado por `bootstrapPersistence`.
 *
 * Importante: NO usamos guard `typeof AppState === 'object'` para
 * gate de SSR — vite/rollup SSR transform emite parse error con
 * `Expected 'from', got 'typeOf'` cuando procesa el bloque durante la
 * transformación de tipos del bundle de tests. `react-native` exporta
 * un mock estable de `AppState` para Node/vitest, así que el acceso
 * directo funciona en ambos runtimes.
 */
let appStateListenerInstalled = false;
let storeSubscribeInstalled = false;

export function bootstrapPersistence(): void {
  if (appStateListenerInstalled) return;
  appStateListenerInstalled = true;
  let prevAppState: string | null = null;
  prevAppState = AppState.currentState ?? null;
  AppState.addEventListener('change', (next) => {
    const goingBackground =
      (prevAppState === 'active' || prevAppState === 'unknown' || prevAppState === null) &&
      (next === 'background' || next === 'inactive');
    prevAppState = next;
    if (!goingBackground) return;
    // Volcado redundante del último snapshot (no depende de
    // `pendingSave`) + drain de cualquier cadena en vuelo. Ambos son
    // best-effort; el OS puede matarnos antes de que `setItem`
    // resuelva, pero cubrimos los dos paths críticos:
    //  - acción que llamó `persistSnapshot` pero todavía no completó.
    //  - mutación intermedia (setXxx del form) sin `await flush`.
    void writeLastSnapshotToDisk();
    void flushPendingSave();
  });

  if (!storeSubscribeInstalled) {
    storeSubscribeInstalled = true;
    // Zustand v5: `subscribe(listener)` recibe `(state, prevState)` después
    // de cada `set`. Mantenemos `lastSnapshot` sincronizado; así el
    // listener de AppState puede volcarlo a disco aún si la cadena
    // `pendingSave` quedó huérfana.
    useCareerStore.subscribe(function syncLastSnapshot(state) {
      lastSnapshot = snapshotToSave(state);
    });
  }
}

if (isPersistentStorage && !isPersistentStorage()) {
  // MGC-363 debug aid: si AsyncStorage cayó al fallback en memoria, las
  // saves se pierden en cada force-stop. Logueamos en `console.warn`
  // para que aparezca en `adb logcat *:S ReactNativeJS:V` y QA pueda
  // diagnosticarlo en el campo sin un dev build.
  // MGC-1195: este bloque estaba duplicado (warnings emitidos 2x); consolidado a
  // una sola evaluación.
  // eslint-disable-next-line no-console
  console.warn(
    '[copero:career] AsyncStorage no resolvió; persistencia en memoria (force-stop pierde la partida).',
  );
}
