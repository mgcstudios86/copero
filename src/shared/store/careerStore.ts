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
  setAge,
} from '@/features/career/identity-state';
import {
  saveCareerSave,
  loadCareerSave,
  clearCareerSave,
  isPersistentStorage,
} from '@/features/career/persistence';
import { wipeAllCoperoKeys } from '@/lib/storage';
import { createRngSnapshot } from '@/features/career/rng';
// MGC-704 — `recordMatchweekResults` necesita la lista de clubes de la
// liga para derivar los fixtures. Importamos sólo el constante, no el
// helper de filtrado por posición.
import { ACADEMY_CLUBS } from '@/features/career/clubs';
import {
  EMPTY_MARKET_STATE,
  applyAcceptedPurchase,
  evaluatePurchaseOffer,
  findMarketPlayer,
  generateMarketPool,
  type MarketOffer,
} from '@/features/career/market';
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
  /**
   * MGC-480 — timestamp (epoch ms) del último `saveCareerSave`
   * confirmado por AsyncStorage. La UI del dashboard lo muestra en
   * el header como "Auto-guardado HH:MM" (modo pasivo) o "Guardando…"
   * (modo `isSaving=true`). `null` cuando nunca se guardó esta
   * sesión (ej. force-stop sin flush) — el header en ese caso dice
   * "Sin guardar". No se persiste; cada arranque arranca en `null`
   * y se popula en el primer `persistSnapshot` que confirme.
   */
  lastSavedAt: number | null;
  /** MGC-480 — true mientras hay una save en vuelo (`pendingSave`
   *  no-nulo). Toggleado por `persistSnapshot` cuando arranca y
   *  cuando la promesa resuelve. Se usa para el spinner animado
   *  del header. */
  isSaving: boolean;
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
  /**
   * MGC-475 — flow mercado-de-pases. Cinco mutaciones del market state en
   * `CareerSnapshot.marketState`:
   *
   *  - `openMarket`: crea/suelta un `MarketState` con pool generado vía
   *    RNG determinista. Idempotente si ya hay uno abierto para la misma
   *    temporada.
   *  - `proposePurchase`: el manager eligió ofertar por un target. Crea la
   *    `MarketOffer` con snapshot del pool y abre la pantalla de detalle.
   *    Si el jugador no existe en el pool actual, resuelve con `null`.
   *  - `confirmPurchase`: la IA aceptó la oferta. Descuenta presupuesto
   *    del club, drena el modal, refresca el pool (sin el jugador
   *    vendido). Devuelve `false` si presupuesto insuficiente o el
   *    jugador fue vendido en background.
   *  - `cancelPurchase`: cierra el modal sin cerrar la operación. La
   *    `MarketOffer` se descarta, el pool NO se modifica.
   *  - `closeMarket`: sale del flow. Setea `status: 'closed'` y vacía
   *    el pool (la próxima vez que se abra se regenera).
   */
  openMarket: () => Promise<void>;
  proposePurchase: (playerId: string, amount: number) => Promise<MarketOffer | null>;
  confirmPurchase: () => Promise<{ ok: boolean; reason?: string }>;
  cancelPurchase: () => Promise<void>;
  closeMarket: () => Promise<void>;
  /**
   * MGC-704 — dispatch de los resultados de la fecha al slice de liga
   * persistible. Idempotente: si la fecha ya fue aplicada, no acumula
   * doble. Llamado por `commitMatch` (WF5) y por `advanceSeason` al
   * cierre de temporada para back-fillear fechas que el flujo WF5
   * pudiera haber saltado (carrera pre-MGC-704, carrera saltada por
   * el self-heal del match, etc.).
   */
  recordMatchweekResults: (week: number, force?: boolean) => Promise<void>;
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
    // MGC-487.3 — vitrina temporada-a-temporada. Persiste junto al
    // resto del snapshot para sobrevivir force-stop; el loader
    // (`hydrateFromSave` + `loadCareerSave`) la aplica con default `[]`
    // para saves legacy que no la traen.
    history: s.history ?? [],
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
    // MGC-475 — persistir el estado del mercado de pases (idle/open/closed).
    marketState: s.marketState ?? null,
    // MGC-704 — slice de liga persistible. Saves legacy lo traen
    // `undefined` → `{}` (placeholder mientras la UI no haya avanzado al
    // menos una fecha). `recordMatchweekResults` lo popula cada vez que
    // se cierra una fecha de liga.
    seasonStandings: s.seasonStandings ?? {},
    seasonFixtures: s.seasonFixtures ?? [],
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
    // MGC-487.3 — vitrina temporada-a-temporada. Mismo default que
    // `snapshotToSave` (saves v:2 legacy traen `undefined` → `[]`).
    history: s.history ?? [],
    seed: s.seed ?? 0,
    // MGC-1730 (HIGH-1 fix sobre PR #425) — exponer los 3 campos F3.2
    // también en `getSnapshot` para que tests E2E / telemetry vean el
    // shape completo sin pasar por save/load.
    postMatchPending: s.postMatchPending ?? null,
    nextWeekModifiers: s.nextWeekModifiers,
    transferState: s.transferState ?? null,
    // MGC-475 — persistir el estado del mercado de pases (idle/open/closed).
    marketState: s.marketState ?? null,
    // MGC-704 — slice de liga persistible. Saves legacy lo traen
    // `undefined` → `{}` (placeholder mientras la UI no haya avanzado al
    // menos una fecha). `recordMatchweekResults` lo popula cada vez que
    // se cierra una fecha de liga.
    seasonStandings: s.seasonStandings ?? {},
    seasonFixtures: s.seasonFixtures ?? [],
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
let pendingSave: Promise<unknown> | null = null;

export function getPendingSave(): Promise<unknown> | null {
  return pendingSave;
}

/**
 * MGC-257 — drena la save pendiente. Llamado por el listener
 * `AppState` en `_layout.tsx` cuando el OS manda la app a background
 * (al briefcase switch, lockscreen, o force-stop inminente). Devuelve
 * la promesa resuelta cuando AsyncStorage confirmó la escritura, así
 * el snapshot queda en disco antes de que el proceso muera.
 */
export async function flushPendingSave(): Promise<void> {
  if (!pendingSave) return;
  await pendingSave;
}

// MGC-716 — guard de re-entrada para `hydrateFromSave`. Cuando el layout
// nativo monta + el dashboard re-monta + un caller externo invocan
// `hydrateFromSave()` casi en paralelo (StrictMode dev, reanimated
// reconciliation, hot reload), cada llamada disparaba un `getItem`
// completo en AsyncStorage. Si el slot estaba vacío, el log
// `[persistence] hydrate=null ...` se emitía 50+ veces/seg, saturaba el
// JS thread y la home quedaba en blanco. La Promise compartida
// coalesce las llamadas concurrentes en una sola lectura; llamadas
// secuenciales (post-resolución) siguen cayendo en `loadCareerSave`
// normal para honrar el flujo `onSlotChanged`.
let hydrationInFlight: Promise<boolean> | null = null;

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
 *
 * MGC-480 — al arrancar la save flippea `isSaving=true` (UI muestra
 * "Guardando…" en el header) y al resolverse setea `isSaving=false`
 * + `lastSavedAt=Date.now()`. El flip a `true` es síncrono (no
 * espera `setItem`), por eso el header reacciona instantáneamente al
 * tap; el flip a `false` espera la resolución del setItem (incl.
 * el caso de fallo → `lastSavedAt` no se actualiza, `isSaving`
 * queda en false para no trabar la UI).
 */
function persistSnapshot(s: CareerStore): void {
  // MGC-480 — flip isSaving al arrancar. Usamos `set((prev) => ...)`
  // vía store.setState para no acoplar este helper a la `setSnapshot`
  // privada (que mezcla set + setSnapshot internamente).
  useCareerStore.setState({ isSaving: true });
  const next = saveCareerSave(snapshotToSave(s))
    .then(() => {
      // Éxito: refrescar timestamp + bajar flag. El `set` vía
      // `useCareerStore.setState` es la API pública de Zustand
      // para mutar sin pasar por el setSnapshot privado (que
      // asume shape `CareerSnapshot` y rompería tipos con campos
      // extra como `lastSavedAt`/`isSaving`).
      useCareerStore.setState({
        lastSavedAt: Date.now(),
        isSaving: false,
      });
    })
    .catch(() => {
      // Silencioso: persistencia best-effort. Loguear en QA si aparece
      // recurrentemente (hoy no hay logger central). Bajamos el flag
      // para que el header no quede colgado en "Guardando…" si
      // AsyncStorage rechazó la escritura.
      useCareerStore.setState({ isSaving: false });
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
    // MGC-480 — inicialización del header de auto-save. `null` para
    // el timestamp significa "no se guardó en esta sesión" (la UI
    // muestra "Sin guardar" en el header hasta el primer save
    // confirmado). `false` para `isSaving` es el estado neutral.
    lastSavedAt: null,
    isSaving: false,
    // Setters livianos: identity-state, sin motor.
    setName: (name) => applyAndPersist((s) => ({ ...s, profile: { ...s.profile, name } })),
    // MGC-1628 / WF1 — apellido separado. Persiste junto al resto del
    // profile; back-compat con saves v:1/v:2 (lastName undefined → '').
    setLastName: (lastName) =>
      applyAndPersist((s) => ({ ...s, profile: { ...s.profile, lastName } })),
    // MGC-1628 / WF1 + MGC-1938 — edad editable. El clamp 16-35 vive en
    // identity-state.setAge (single source of truth); acá delegamos para
    // que cualquier caller (TextInput, programmatic set, tests) herede la
    // validación. MGC-1938 fix: antes el import se borraba por lint
    // unused y el clamp quedaba como responsabilidad del UI; ahora el
    // cablear aplica el clamp también en este entrypoint.
    setAge: (age) => applyAndPersist((s) => setAge(s, age)),
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
    // ── MGC-475 — flow mercado-de-pases ──────────────────────────────
    //
    // Cinco mutaciones puras sobre `marketState`. NO pasan por el engine
    // (son capa UI/store: el mercado es un overlay de la simulación, no
    // parte del motor puro). Persisten vía `applyAndPersist` /
    // `flushPendingSave` para sobrevivir force-stop durante la oferta.
    //
    // RNG: usamos el `seed` del snapshot (`profile.season` + `s.seed`)
    // como semilla del pool. Si el seed es 0 (carrera muy vieja),
    // caemos a un derivado del season para mantener determinismo.
    openMarket: async () => {
      const s = get();
      const current = s.marketState ?? EMPTY_MARKET_STATE;
      // Idempotente: si ya hay un market abierto para la misma temporada,
      // no regeneramos el pool (mantiene determinismo dentro de la sesión).
      if (current.status === 'open' && current.season === s.profile.season) {
        return;
      }
      const seedBase = (s.seed ?? 0) ^ (s.profile.season * 31);
      const poolSeed = seedBase === 0 ? s.profile.season * 1009 + 7 : seedBase;
      const excludeClubId = s.profile.club?.id ?? null;
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { createRng } = await import('@/features/career/rng');
      const rng = createRng(poolSeed);
      const pool = generateMarketPool(rng, { seed: poolSeed, excludeClubId });
      // Pool generado. El RNG se descarta; lo persistimos vía el snapshot.
      applyAndPersist((snap) => ({
        ...snap,
        marketState: {
          status: 'open',
          pool,
          pendingOffer: null,
          season: snap.profile.season,
        },
      }));
    },
    proposePurchase: async (playerId, amount) => {
      const s = get();
      const ms = s.marketState;
      if (!ms || ms.status !== 'open') return null;
      const target = findMarketPlayer(ms.pool, playerId);
      if (!target) return null;
      const offer: MarketOffer = {
        id: `offer_${playerId}`,
        playerId,
        amount: Math.max(0, Math.floor(amount)),
        verdict: 'pending',
        playerSnapshot: target,
      };
      applyAndPersist((snap) => ({
        ...snap,
        marketState: {
          ...ms,
          status: 'awaiting',
          pendingOffer: offer,
        },
      }));
      return offer;
    },
    confirmPurchase: async () => {
      const s = get();
      const ms = s.marketState;
      if (!ms || !ms.pendingOffer) return { ok: false, reason: 'no_offer' };
      const offer = ms.pendingOffer;
      const target = findMarketPlayer(ms.pool, offer.playerId);
      // Vendido en background (pool refrescado en otra sesión / mutated).
      if (!target) {
        applyAndPersist((snap) => ({
          ...snap,
          marketState: {
            ...ms,
            status: 'open',
            pendingOffer: null,
          },
        }));
        return { ok: false, reason: 'player_unavailable' };
      }
      // IA decide (RNG determinista).
      const seedRng = ((s.seed ?? 0) ^ (ms.season * 17) ^ parseInt(offer.id.slice(-4) || '0', 10)) || 1;
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { createRng } = await import('@/features/career/rng');
      const rng = createRng(seedRng);
      const accepted = evaluatePurchaseOffer({
        offeredAmount: offer.amount,
        marketValue: target.value,
        sellingClubReputation: target.fromClub.reputation ?? 3,
        buyerClubOvr: s.profile.ovr,
        playerOvr: target.ovr,
        rng,
      });
      if (!accepted) {
        // IA rechaza: persistir verdict, dejar modal cerrado y permitir
        // re-ofertar. No tocamos presupuesto.
        applyAndPersist((snap) => ({
          ...snap,
          marketState: {
            ...ms,
            status: 'open',
            pendingOffer: null,
          },
        }));
        return { ok: false, reason: 'ia_rejected' };
      }
      // Aceptada: aplicar compra.
      const result = applyAcceptedPurchase({
        offer,
        currentBudget: s.profile.clubPresupuesto,
        currentPool: ms.pool,
      });
      if (!result.ok) {
        applyAndPersist((snap) => ({
          ...snap,
          marketState: {
            ...ms,
            status: 'open',
            pendingOffer: null,
          },
        }));
        return { ok: false, reason: result.reason };
      }
      const newPool = ms.pool.filter((p) => p.id !== offer.playerId);
      applyAndPersist((snap) => ({
        ...snap,
        profile: {
          ...snap.profile,
          clubPresupuesto: result.newBudget,
        },
        marketState: {
          ...ms,
          status: 'open',
          pendingOffer: null,
          pool: newPool,
        },
      }));
      return { ok: true };
    },
    cancelPurchase: async () => {
      applyAndPersist((s) => ({
        ...s,
        marketState: s.marketState
          ? { ...s.marketState, status: 'open', pendingOffer: null }
          : s.marketState,
      }));
    },
    closeMarket: async () => {
      applyAndPersist((s) => ({
        ...s,
        marketState: {
          status: 'closed',
          pool: [],
          pendingOffer: null,
          season: s.profile.season,
        },
      }));
    },
    // MGC-704 — dispatch de los resultados de la fecha al slice de liga.
    // Calcula los fixtures round-robin con el seed actual del snapshot,
    // simula el resultado de cada partido de la fecha (idempotente: si
    // el partido ya está registrado, no acumula doble) y actualiza
    // `seasonStandings` + `seasonFixtures`. Persistencia inmediata
    // (async + flushPendingSave) para sobrevivir force-stop, mismo
    // patrón que `commitMatch`.
    recordMatchweekResults: async (week, force) => {
      const s = get();
      if (week < 1 || week > 38) return;
      const {
        generateLeagueFixtures,
        simulateMatchGoals,
        applyResultToStandings,
        emptyStandings,
      } = await import('@/features/career/phase');
      const clubs = s.profile.club
        ? Array.from(new Set([s.profile.club.name, ...ACADEMY_CLUBS.map((c) => c.name)]))
        : ACADEMY_CLUBS.map((c) => c.name);
      const seedBase = (s.seed ?? 0) ^ (s.profile.season * 1009);
      const fixtures = generateLeagueFixtures(clubs, seedBase || 1);
      const matchweekFixtures = fixtures.filter((f) => f.week === week);
      if (matchweekFixtures.length === 0) return;
      const playedIds = new Set(
        (s.seasonFixtures ?? []).map((f) => `${f.week}:${f.homeId}:${f.awayId}`),
      );
      let nextStandings = s.seasonStandings ?? emptyStandings(clubs);
      const nextFixtures = [...(s.seasonFixtures ?? [])];
      let mutated = false;
      for (const f of matchweekFixtures) {
        const k = `${f.week}:${f.homeId}:${f.awayId}`;
        if (playedIds.has(k) && !force) continue;
        const result = simulateMatchGoals(f.homeId, f.awayId, seedBase + f.week);
        nextStandings = applyResultToStandings(
          nextStandings,
          f.homeId,
          f.awayId,
          result.homeGoals,
          result.awayGoals,
        );
        nextFixtures.push({ ...f, ...result });
        mutated = true;
      }
      if (!mutated) return;
      setSnapshot((snap) => ({
        ...snap,
        seasonStandings: nextStandings,
        seasonFixtures: nextFixtures,
      }));
      persistSnapshot(get());
      await flushPendingSave();
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
      const { advanceWeek, weeklyRng, getPositionStats } = await import(
        '@/features/career/simulation'
      );
      const { runPostMatch, ratingFromScore } = await import(
        '@/features/career/events'
      );
      const { runSocialEvent, mergeModifiers } = await import(
        '@/features/career/social-events'
      );
      const { createRngFromSnapshot } = await import('@/features/career/rng');
      const ms = useMatchStore.getState();
      if (!ms.outcome || !ms.nextProfile) {
        useMatchStore.getState().reset();
        return;
      }
      const advanced = advanceWeek(ms.nextProfile!);

      // MGC-2011 — bug HIGH del walk F4 (MGC-1915). El flujo dashboard
      // (commitMatch) saltea `engine.step({type: 'resolveMatchweek'})`,
      // así que `socialEventPending`/`postMatchPending`/`nextWeekModifiers`
      // quedaban siempre `null` y `post-match.tsx:60` enrutaba directo al
      // dashboard sin pasar por `/social-events`. Espejamos el bloque de
      // `engine.ts#resolveMatchweek` (runPostMatch → runSocialEvent →
      // mergeModifiers) usando el rating del outcome ya commiteado. El
      // cursor RNG es `state.rng` (idéntico al semanal post-`applyWeekly
      // Choice`); si por deeplink directo a /match no hay cursor previo,
      // caemos a `weeklyRng(profile, 'match')` — mismo seed pattern que
      // `resolveWeeklyMatch` (simulation.ts:645) para mantener paridad de
      // determinismo con el semanal flow.
      const state = get();
      const baseRng = state.rng
        ? createRngFromSnapshot(state.rng)
        : weeklyRng(advanced, 'match').rng;
      const positionStats = getPositionStats(advanced);
      const ratingValue = ratingFromScore(ms.outcome.score);
      const { event, modifiers: postModifiers } = runPostMatch(
        {
          position: advanced.position,
          positionStats,
          rating: ratingValue,
          form: advanced.career.confianza,
          week: advanced.week,
        },
        baseRng,
      );
      const socialResult = runSocialEvent(
        {
          position: advanced.position,
          positionStats,
          rating: ratingValue,
          week: advanced.week,
        },
        baseRng.snapshot(),
      );
      const merged = mergeModifiers(postModifiers, socialResult.modifiers);
      // Un solo setSnapshot para evitar la race entre el set anterior
      // (sólo profile) y éste (eventos + rng): Zustand re-renderiza entre
      // updates y `post-match.tsx` puede leer un estado intermedio donde
      // `profile.week` ya avanzó pero `socialEventPending` aún es null.
      setSnapshot((s) => ({
        ...s,
        profile: advanced,
        postMatchPending: event,
        socialEventPending: socialResult.event,
        nextWeekModifiers: merged,
        rng: socialResult.rngSnapshot,
      }));

      // MGC-704 — dispatch de los resultados de la fecha al slice de
      // liga. Se llama DESPUÉS del setSnapshot para que `advanced.week`
      // ya esté actualizado. La acción es idempotente, así que un
      // retry post force-stop no acumula doble.
      try {
        await get().recordMatchweekResults(advanced.week);
      } catch {
        // best-effort: si falla la simulación (imports rotos), el
        // placeholder determinista de `getStandingsForDisplay` cubre la
        // UI. El próximo `commitMatch` reintentará.
      }

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
      // MGC-704 — backfill de la liga para fechas que el flujo WF5
      // (commitMatch) pudiera haberse saltado (carrera pre-MGC-704,
      // self-heal del match que reintentó startMatch sin commitMatch,
      // o advance manual desde una pantalla distinta de /match). La
      // acción es idempotente vía `seasonFixtures[]`.
      try {
        await get().recordMatchweekResults(get().profile.week);
      } catch {
        // best-effort: ver commitMatch.
      }
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
      // MGC-704 — backfill de la última fecha antes de rotar temporada.
      // El advanceSeason usualmente corre con `profile.week >= 38` así
      // que la fecha que falta es la 38. La acción es idempotente.
      try {
        await get().recordMatchweekResults(get().profile.week);
      } catch {
        // best-effort.
      }
      setSnapshot((s) =>
        step(s, { type: 'advanceSeason' } satisfies CareerAction),
      );
      // MGC-704 — reset del slice de liga al rotar temporada. La nueva
      // temporada arranca con standings y fixtures vacíos.
      setSnapshot((s) => ({
        ...s,
        seasonStandings: {},
        seasonFixtures: [],
      }));
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
    //
    // MGC-716 — guard de re-entrada con `hydrationInFlight`. Si un caller
    // vuelve a invocar `hydrateFromSave()` mientras una llamada previa
    // todavía está en vuelo (ej: StrictMode dev re-mount, hot reload, o
    // un path interno que vuelve a llamar al bootstrap del layout),
    // coalescemos en la misma Promise en vez de disparar N lecturas de
    // AsyncStorage en paralelo. Cada lectura extra emitía
    // `[persistence] hydrate=null ... reason=no-snapshot-in-storage` y,
    // combinado con la cascada de renders que se gatillaba, saturaba el
    // JS thread hasta dejar la home en blanco.
    hydrateFromSave: async () => {
      // MGC-716 — coalesce de llamadas concurrentes. Si ya hay una
      // hidratación en vuelo (StrictMode dev, layout effect doble,
      // reanimated reconciliation), devolvemos la misma Promise en vez
      // de disparar N lecturas paralelas de AsyncStorage. Cada lectura
      // extra emitía `[persistence] hydrate=null ... reason=no-snapshot-
      // in-storage` y, combinado con la cascada de renders que se
      // gatillaba, saturaba el JS thread hasta dejar la home en blanco.
      // Llamadas secuenciales (no concurrentes) siguen corriendo
      // normalmente: el `dashboard.onSlotChanged` depende de un
      // re-hydrate explícito al cambiar slot (test slot-multi-save
      // #264 espera reset a initialSnapshot cuando el slot activo
      // queda sin payload).
      if (hydrationInFlight) return hydrationInFlight;
      hydrationInFlight = (async (): Promise<boolean> => {
        let saved: Awaited<ReturnType<typeof loadCareerSave>> = null;
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
          // MGC-2999 — defensa en profundidad. Si no hay payload para el
          // slot activo (slot recién creado vía picker sin payload legacy,
          // o slot vaciado por deleteSlot), el store podría seguir
          // cargando state del slot previo. Reseteamos a initialSnapshot
          // y dejamos que el caller (`dashboard.onSlotChanged`) o el
          // próximo `applyAndPersist` reescriban limpio bajo el key
          // activo. Esto garantiza que dos slots nunca comparten state.
          setSnapshot(() => initialSnapshot());
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
          // MGC-487.3 — vitrina temporada-a-temporada. Saves legacy
          // (pre-MGC-487.3) no la traen → default `[]` para que la UI
          // muestre "VITRINA VACÍA" en vez de explotar.
          history: saved.history ?? [],
          seed: saved.seed,
          rng: saved.rng,
          // MGC-1730 (HIGH-2 fix sobre PR #425) — copiar los 3 campos F3.2
          // del save al store. `loadCareerSave` ya aplicó
          // `hydrateF3Fields`, así que vienen con defaults si eran
          // `undefined` en disco.
          postMatchPending: saved.postMatchPending ?? null,
          nextWeekModifiers: saved.nextWeekModifiers,
          transferState: saved.transferState ?? null,
          // MGC-475 — hidratar mercado con default si el save v:1/v:2 no
          // lo trae (carreras iniciadas antes de MGC-475).
          marketState: saved.marketState ?? EMPTY_MARKET_STATE,
          // MGC-704 — slice de liga persistible. Saves legacy lo traen
          // `undefined` → `{}` para que `getStandingsForDisplay` caiga al
          // placeholder determinista hasta que el usuario avance al menos
          // una fecha.
          seasonStandings: saved.seasonStandings ?? {},
          seasonFixtures: saved.seasonFixtures ?? [],
        }));
        set((s) => ({ ...s, hydrated: true }));
        return true;
      })();
      try {
        return await hydrationInFlight;
      } finally {
        hydrationInFlight = null;
      }
    },
    // reset: estado inicial sin motor. Borra el save persistido.
    // MGC-2606 — el `void clearCareerSave()` fire-and-forget generaba una
    // carrera con el `saveCareerSave` del test siguiente (el `removeItem`
    // del clear corría en el microtask queue después del `setItem` del
    // save, borrando el snapshot recién escrito). El comentario anterior
    // decía "si falla el clear, el próximo save sobrescribe" — la misma
    // lógica aplica acá: el próximo save del usuario sobrescribe el slot
    // sí o sí, así que el clear es redundante para la persistencia.
    // Para CTA destructivo que SÍ necesita clear + await ver `resetAll`.
    reset: () => {
      setSnapshot(() => initialSnapshot());
    },
    // MGC-1736 (WF6) — variant awaitable de reset. Ordena:
    //   1) flushPendingSave: drena la save en vuelo al disco para
    //      que NO compita con el clear siguiente.
    //   2) reset memoria: vuelve al initialSnapshot.
    //   3) await wipeAllCoperoKeys + clearCareerSave (en paralelo):
    //      ambos paths cubren el AC de "state idéntico a primera
    //      instalación":
    //        - wipeAllCoperoKeys enumera y borra TODAS las keys de
    //          AsyncStorage conocidas de Copero (carrera + legacy +
    //          game stats + quiz) — vía `AsyncStorage.getAllKeys()`.
    //        - clearCareerSave borra la save legacy + resetea el
    //          fallback en memoria privado de `persistence.ts` (que
    //          cachea la save en RAM si `pickStorage()` no resolvió
    //          el backend nativo, e.g. tests jsdom sin mock).
    //
    // MGC-215 — Antes esta función llamaba `clearCareerSave()`, que sólo
    // removía `copero:career:save:v1` + legacy `copero-career`. Las keys
    // de `copero-game-stats` (highScore/bestStreak) y `copero:ideologia:v1:*`
    // (progreso del quiz) sobrevivían como zombies y el siguiente
    // onboarding las re-hidrataba con data fantasma. El AC de MGC-215
    // ("state idéntico a primera instalación") cierra con la combinación
    // `wipeAllCoperoKeys + clearCareerSave`. Cada uno cubre un eje:
    // wipe en bloque el disco, clear el cache en memoria del módulo de
    // persistencia.
    resetAll: async () => {
      try {
        await flushPendingSave();
      } catch {
        // best-effort: si flush falla seguimos con el reset memoria
        // y el clear; el peor caso es la misma ventana que reset().
      }
      setSnapshot(() => initialSnapshot());
      // MGC-215: wipeAllCoperoKeys + clearCareerSave en paralelo. Cada
      // uno tiene un catch independiente — un fallo parcial no aborta
      // al otro. Si wipeAllCoperoKeys explota, clearCareerSave igual
      // limpia la save legacy + el memoryStore privado del módulo de
      // persistencia. Si clearCareerSave explota, wipeAllCoperoKeys
      // igual limpia el AsyncStorage nativo.
      await Promise.all([
        wipeAllCoperoKeys().catch(() => {
          // best-effort: wipe de bloque falló — clear puntual corre
          // abajo como red de seguridad.
        }),
        clearCareerSave().catch(() => {
          // best-effort: clear puntual falló — wipe de bloque ya
          // removió las keys conocidas del disco si resolvió.
        }),
      ]);
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

// MGC-2264 — exponer el store en window para Playwright web.
// En el runner self-hosted `copero-heavy` (Chromium headless sobre ARM64),
// RNW no propaga el evento `input` sintetico de `page.fill()` al handler
// React `onChangeText` en algunos inputs controlados (input-name,
// input-lastname, input-nationality-search, input-age). El state React queda
// vacio y `btn-identity-continue` permanece `disabled`. Tests E2E pueden
// bypasear el path de UI llamando setters directos via `page.evaluate`:
//   window.__careerStore.getState().setName('CALVO')
// Solo aplica en build web (typeof window !== 'undefined') y se gatea
// detrás de EXPO_PUBLIC_E2E === '1' (MGC-2954). Antes era NODE_ENV !== 'production',
// pero el bundle Expo web de CI corre con NODE_ENV=production y Metro
// tree-shakeaba el bloque, dejando `window.__careerStore` undefined en
// Playwright CI aunque el helper e2e/career-test-helpers.ts lo esperara.
// `EXPO_PUBLIC_*` se inline en el bundle en build time (Metro los expone
// vía `process.env.EXPO_PUBLIC_*`), así que el gate es estable bajo
// tree-shaking. El workflow `.github/workflows/qa.yml` inyecta
// `EXPO_PUBLIC_E2E=1` solo en el step `Build Expo web bundle` (no en
// runs de producción), garantizando que el bundle shipped a usuarios
// NO expone el store. Native (iOS/Android) sigue funcionando igual;
// este bloque es no-op fuera de web y nunca se exporta al bundle hermes.
if (
  typeof process !== 'undefined' &&
  process.env.EXPO_PUBLIC_E2E === '1' &&
  typeof window !== 'undefined'
) {
  (window as unknown as { __careerStore?: typeof useCareerStore }).__careerStore =
    useCareerStore;
}
