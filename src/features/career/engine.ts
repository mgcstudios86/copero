import type {
  CareerSnapshot,
  CareerStage,
  Club,
  ClubArchetype,
  EstiloRasgo,
  Foot,
  PlayerProfile,
  Position,
  StrategyId,
  YearlyPlan,
} from '@/types/career';
import { affectedAttrFor } from '@/types/career';
import {
  applyChoice,
  applyWeeklyChoice,
  advanceWeek,
  resolveWeeklyMatch,
  getPositionStats,
} from './simulation';
import { createRng, createRngFromSnapshot, seedFromString, type RngSnapshot } from './rng';
import {
  cardFromPicks,
  initialDraftBoard,
  pickCurrentLegend,
  swapLegend,
  attrsFromCard,
} from './draft';
import { advanceSeason, isRetired, runCareerLoop } from './season';
import { STAT_INIT } from './position-stats';
import type { WeeklyBaseOptionId } from './position-tree';
import { groupOf } from './positions';
import {
  ratingFromScore,
  runPostMatch,
  NO_MODIFIERS,
} from './events';
import { mergeModifiers, runSocialEvent } from './social-events';
import {
  evaluateTransfer,
  acceptOffer,
  declineAllOffers,
  type TransferInput,
  type TransferState,
} from './transfers';
import { walkTree } from './decision-tree';

/**
 * Reducer puro para el state machine del simulador de carrera (MGC-430
 * + MGC-442 + MGC-208).
 *
 * Cadena: identity -> dashboard -> academy -> clubStart -> draft ->
 * club -> season* -> retirement.
 *
 * La simulación semanal corre con RNG determinista por (week, season)
 * para que QA valide feedback estable (acceptance bar #7 de
 * strategies.md). El draft y el loop anual usan el mismo `seed`
 * guardado en el snapshot para que la carrera sea reproducible.
 */

export type CareerAction =
  | { type: 'setName'; name: string }
  // MGC-1628 / WF1 — apellido separado del nombre (form del alta).
  | { type: 'setLastName'; lastName: string }
  // MGC-1628 / WF1 — edad editable 16-35 (clamp en reducer).
  | { type: 'setAge'; age: number }
  | { type: 'setNumber'; number: number }
  | { type: 'setPosition'; position: Position }
  | { type: 'setNationality'; code: string }
  | { type: 'setPreferredFoot'; foot: Foot }
  | { type: 'commitIdentity' }
  | { type: 'commitIdentityAndDraft'; seed?: number }
  | { type: 'openAcademy' }
  | { type: 'acceptClub'; club: Club }
  | { type: 'decide'; strategyId: StrategyId; choiceId: string }
  /** MGC-1657 (F2.3) — decisión semanal V2. Reemplaza al flujo V1 para
   * el weekly screen; persiste `positionStats` y dispara `maybeRollInjury`
   * post-choice. Idempotente en lesión activa: la única opción válida
   * es `rehabilitacion`. */
  | { type: 'weeklyChoice'; optionId: WeeklyBaseOptionId }
  /** MGC-1657 (F2.3) — invocación de `resolveMatch` al cierre de la
   * matchweek. Suma goals+apps al `profile.stats` y deja el resultado
   * en `career.matchweekStats`. */
  | { type: 'resolveMatchweek' }
  | { type: 'setYearlyPlan'; plan: YearlyPlan }
  /** MGC-1505 — toggle de rasgo (multi-select hasta 2). El reducer hace
   * toggle on/off + dedupe + cap 2; la UI no necesita enforced logic. */
  | { type: 'setEstilo'; rasgos: EstiloRasgo[] }
  | { type: 'advance' }
  | { type: 'startDraft'; seed?: number }
  | { type: 'swapLegend' }
  | { type: 'pickLegend' }
  | { type: 'pickClub'; club: Club }
  | { type: 'advanceSeason' }
  | { type: 'runCareerToRetirement' }
  /** MGC-1730 (HIGH-1 fix sobre PR #425) — drena `postMatchPending`
   * después de que la UI muestra el modal post-partido. Acepta `null`
   * explícito para forzar el cierre sin que la UI haya leído el evento
   * (caso edge: force-stop entre `resolveMatchweek` y el render). */
  | { type: 'clearPostMatch' }
  /** MGC-1730 (HIGH-1 fix sobre PR #425) — resuelve el transfer system
   * al cierre de temporada. `acceptedOfferId: null` declina todas y
   * aplica `no_movement` explícito (mismo efecto que
   * `declineAllOffers`). */
  | { type: 'resolveTransfer'; acceptedOfferId: string | null }
  | { type: 'reset' };

export const initialProfile: PlayerProfile = {
  name: '',
  number: 9,
  position: 'ST',
  nationalityCode: 'AR',
  leagueCode: '',
  preferredFoot: 'right',
  age: 16,
  club: null,
  value: 0,
  ovr: 50,
  stats: { apps: 0, goals: 0, ast: 0 },
  attrs: { tecnico: 60, fisico: 60, mental: 60, portero: 50 },
  career: {
    presupuesto: 0,
    moral: 70,
    fisico: 80,
    confianza: 60,
    racha: 0,
    // MGC-1663: pasar por helper para mantener un único punto de mapeo.
    lesion: { kind: 'ninguna', fechasOut: 0, startedAtWeek: 0, affectedAttr: affectedAttrFor('ninguna') },
    reputation: {
      prensa: 'neutral',
      hinchada: 'aceptado',
      vestuario: 'integrado',
      seleccionConvocado: false,
    },
    doubleShiftStreak: 0,
    matchweekStats: { clubId: '', apps: 0, goals: 0, ast: 0 },
  },
  // MGC-1657 (F2.3) — stats posicionales V2 inicializados en 50 (mediano)
  // por slot. La migración v:1→v:2 también produce este shape.
  positionStats: { ...STAT_INIT },
  week: 1,
  season: 1,
  clubPresupuesto: 0,
  clubInteres: false,
};

export const initialSnapshot = (): CareerSnapshot => ({
  stage: 'identity',
  profile: { ...initialProfile },
  draft: null,
  card: null,
  log: { timeline: [], events: [] },
});

export function step(state: CareerSnapshot, action: CareerAction): CareerSnapshot {
  switch (action.type) {
    case 'setName':
      return { ...state, profile: { ...state.profile, name: action.name } };
    // MGC-1628 / WF1 — apellido separado. Mismo spread inmutable que
    // `setName`; el motor no necesita tocarlo, sólo persistir.
    case 'setLastName':
      return { ...state, profile: { ...state.profile, lastName: action.lastName } };
    // MGC-1628 / WF1 — edad editable. Clamp 16-35 idéntico al setter
    // del store (identity-state.ts#setAge) para mantener una sola
    // fuente de verdad.
    case 'setAge': {
      const a = Math.max(16, Math.min(35, Math.floor(Number.isFinite(action.age) ? action.age : 16)));
      return { ...state, profile: { ...state.profile, age: a } };
    }
    case 'setNumber': {
      const n = Math.max(1, Math.min(99, Math.floor(action.number)));
      return { ...state, profile: { ...state.profile, number: n } };
    }
    case 'setPosition':
      return { ...state, profile: { ...state.profile, position: action.position } };
    case 'setNationality':
      return { ...state, profile: { ...state.profile, nationalityCode: action.code } };
    case 'setPreferredFoot':
      return { ...state, profile: { ...state.profile, preferredFoot: action.foot } };
    case 'commitIdentity':
      return { ...state, stage: 'dashboard' };
    case 'commitIdentityAndDraft': {
      // MGC-249: el flujo "Empezar carrera" desde el home/identity enruta
      // directo al draft (sin pasar por dashboard) para no romper la cadena
      // draft → club → temporada. Inicializa board + seed determinista.
      const seed = action.seed ?? seedFromString(state.profile.name || 'copero');
      return {
        ...state,
        stage: 'draft',
        draft: initialDraftBoard(),
        card: null,
        seed,
      };
    }
    case 'openAcademy':
      return { ...state, stage: 'academy' };
    case 'acceptClub':
      return {
        ...state,
        stage: 'clubStart',
        profile: {
          ...state.profile,
          club: action.club,
          clubPresupuesto: action.club.presupuesto,
          clubInteres: true,
        },
      };
    case 'decide': {
      const seed = state.profile.week * 1009 + state.profile.season * 31 + seedFromString(action.strategyId);
      const { profile } = applyChoice(
        state.profile,
        action.strategyId,
        action.choiceId,
        createRng(seed),
      );
      return { ...state, profile };
    }
    case 'weeklyChoice': {
      // MGC-1657 (F2.3) — flujo V2 semanal. Garantiza positionStats
      // presente (hidrata STAT_INIT si el profile viene de save v:1 no
      // migrado).
      // MGC-1676 — pasa `state.rng` para que el cursor se reanude y se
      // persista tras la decisión (replay determinista post force-stop).
      const profileWithStats: PlayerProfile =
        state.profile.positionStats
          ? state.profile
          : { ...state.profile, positionStats: { ...STAT_INIT } };
      const result = applyWeeklyChoice(profileWithStats, action.optionId, state.rng as RngSnapshot | undefined);
      return { ...state, profile: result.profile, rng: result.rngSnapshot };
    }
    case 'resolveMatchweek': {
      // MGC-1657 (F2.3) — cierre de matchweek. Acumula stats y deja
      // evidencia en `career.matchweekStats`. El caller (UI semanal)
      // decide cuándo disparar (manual vs auto al cierre del weekly
      // choice de tipo partido).
      // MGC-1676 — pasa `state.rng` y persiste snapshot avanzado.
      // MGC-1730 (HIGH-1 fix sobre PR #425) — además dispara el motor
      // F3.2 `runPostMatch` para producir el evento post-partido (ADR-
      // 0017 §1/§2). El evento queda en `state.postMatchPending` para
      // que la UI F3.3 lo muestre y `state.nextWeekModifiers` para que
      // el `weeklyChoice` siguiente los consuma. Si el evento es `null`
      // (rating < 6.0) igual materializamos `nextWeekModifiers` con
      // `NO_MODIFIERS` para que el caller no tenga que nullear.
      // MGC-1738 / MGC-1762 (F4) — encadena `runSocialEvent` sobre el
      // cursor YA avanzado por `runPostMatch`, y compone ambos vía
      // `mergeModifiers` (luckBonus MAX, injuryRiskMul producto,
      // fatigue/moral/confianza suma, trainingBoost MIN; clamp
      // injuryRiskMul ≤ 2.5). El evento social queda en
      // `state.socialEventPending` para que la UI F4 lo muestre.
      const result = resolveWeeklyMatch(state.profile, state.rng as RngSnapshot | undefined);
      const rngForEvent = createRngFromSnapshot(result.rngSnapshot);
      const positionStats = getPositionStats(result.profile);
      const ratingValue = ratingFromScore(result.match.score);
      const { event, modifiers: postModifiers } = runPostMatch(
        {
          position: result.profile.position,
          positionStats,
          rating: ratingValue,
          form: result.profile.career.confianza,
          week: result.profile.week,
        },
        rngForEvent,
      );
      const socialResult = runSocialEvent(
        {
          position: result.profile.position,
          positionStats,
          rating: ratingValue,
          week: result.profile.week,
        },
        rngForEvent.snapshot(),
      );
      const merged = mergeModifiers(postModifiers, socialResult.modifiers);
      return {
        ...state,
        profile: result.profile,
        rng: socialResult.rngSnapshot,
        postMatchPending: event,
        socialEventPending: socialResult.event,
        nextWeekModifiers: merged,
      };
    }
    case 'setYearlyPlan': {
      // MGC-1017: el usuario elige un plan anual al cierre de cada
      // temporada. Se persiste en `profile.career.yearlyPlan` y se
      // CONSUME en el próximo `advanceSeason` (que lo resetea a
      // `undefined` después de aplicar el modifier). Esto garantiza
      // que el loop requiera decisión cada año.
      if (state.stage !== 'season' && state.stage !== 'club' && state.stage !== 'clubStart') {
        // El plan sólo aplica una vez iniciada la vida de carrera
        // profesional; antes del primer partido lo ignoramos.
        return state;
      }
      return {
        ...state,
        profile: {
          ...state.profile,
          career: { ...state.profile.career, yearlyPlan: action.plan },
        },
      };
    }
    case 'setEstilo': {
      // MGC-1505: setter idempotente. La UI ya garantiza cap 2 + dedupe,
      // pero el reducer re-sanitiza defensivamente: dedupe (Set), cap 2,
      // descartar valores que no estén en el catálogo canónico.
      const allowed = new Set<EstiloRasgo>(['magneto-mediatico', 'trotamundos']);
      const cleaned = Array.from(
        new Set(action.rasgos.filter((r): r is EstiloRasgo => allowed.has(r))),
      ).slice(0, 2);
      return {
        ...state,
        profile: {
          ...state.profile,
          career: { ...state.profile.career, estilo: cleaned },
        },
      };
    }
    case 'advance': {
      // MGC-441 / MGC-491: si la semana llega al rollover (week >= 38) y
      // hay club asignado, delegamos al helper compartido de rollover
      // (`applySeasonRollover`) para acumular OP/OG/OA y demás stats
      // anuales. Mantiene granularidad semanal fina para semanas 1..37 y
      // anual para el cierre de temporada (recomendación CTO opción 1).
      // Si no hay club, fallback a `advanceWeek` (no-op silencioso para
      // stats; el rollover cronológico de season/week/age sí ocurre, ver
      // MGC-441 causa 2).
      if (state.profile.week >= 38 && state.profile.club) {
        return applySeasonRollover(state);
      }
      return { ...state, profile: advanceWeek(state.profile) };
    }
    case 'startDraft': {
      const seed = action.seed ?? seedFromString(state.profile.name || 'copero');
      return {
        ...state,
        stage: 'draft',
        draft: initialDraftBoard(),
        card: null,
        seed,
      };
    }
    case 'swapLegend': {
      if (!state.draft) return state;
      return { ...state, draft: swapLegend(state.draft) };
    }
    case 'pickLegend': {
      if (!state.draft) return state;
      const result = pickCurrentLegend(state.draft);
      const card = result.card ?? state.card;
      const stage = result.card ? 'club' : 'draft';
      // Cuando se confirma el último pick, mezclamos la card al profile
      // y pasamos al selector de club.
      if (result.card) {
        const merged = applyCardToProfile(state.profile, result.card);
        return {
          ...state,
          stage,
          draft: result.board,
          card,
          profile: merged,
        };
      }
      return { ...state, draft: result.board, card };
    }
    case 'pickClub': {
      if (!state.card) return state;
      const archetype: ClubArchetype = action.club.archetype ?? 'EQUILIBRIO';
      // Modificadores del arquetipo: DESARROLLO +2 OVR inicial;
      // EQUILIBRIO +1; AMBICIÓN +0 pero reputación alta.
      const archetypeBonus = archetype === 'DESARROLLO' ? 2 : archetype === 'EQUILIBRIO' ? 1 : 0;
      // MGC-249: fit bonus por posición del club. Si el club declara
      // `positionGroups` y el jugador está en ese grupo, suma +1 OVR.
      // La asignación typed a `unknown` evita el ciclo entre engine y clubs.
      const fit = (action.club as unknown as { fitBonus?: number; positionGroups?: string[] })
        .fitBonus ?? 0;
      // MGC-1628 rev 3 §L4 — `groupOf` se importa desde `positions.ts`
      // (helper canónico F2.1). Antes era un `groupMap` inline; ahora
      // es un solo switch exportado, consumible también por `match.ts`
      // y `stats.ts`.
      const playerGroupResolved = groupOf(state.profile.position);
      const positionGroups = (action.club as unknown as { positionGroups?: string[] })
        .positionGroups ?? [];
      const fitBonus =
        positionGroups.includes(playerGroupResolved) ? fit : 0;
      const bonus = archetypeBonus + fitBonus;
      const profile: PlayerProfile = {
        ...state.profile,
        club: action.club,
        clubPresupuesto: action.club.presupuesto,
        clubInteres: true,
        ovr: Math.min(99, state.profile.ovr + bonus),
        season: 1,
        week: 1,
      };
      return {
        ...state,
        stage: 'season',
        profile,
      };
    }
    case 'advanceSeason': {
      // MGC-491: delega al helper compartido para garantizar que la
      // delegación desde `case 'advance'` (week >= 38 && club) y la
      // acción explícita `advanceSeason` (botón "Jugar temporada")
      // produzcan exactamente la misma transición de temporada, stats y
      // timeline. Antes esto era recursión `step(state, {type: 'advanceSeason'})`
      // — funcionaba, pero el código duplicado entre los dos paths
      // dejaba margen a drift accidental en el seed o en el merge del
      // log. Ahora es una sola función pura.
      return applySeasonRollover(state);
    }
    case 'runCareerToRetirement': {
      if (!state.profile.club) return state;
      const baseSeed = state.seed ?? seedFromString(state.profile.name || 'copero');
      const seed = baseSeed + seedFromString(state.profile.name || 'copero');
      const result = runCareerLoop(state.profile, state.profile.club, createRng(seed));
      return {
        ...state,
        stage: 'retirement',
        profile: result.profile,
        log: result.log,
      };
    }
    // MGC-1730 (HIGH-1 fix sobre PR #425) — drena `postMatchPending`
    // cuando la UI consumió el evento post-partido. También limpia
    // `nextWeekModifiers` (que se consumen juntos: si la UI leyó el
    // modal, los modificadores ya fueron aplicados).
    // MGC-1738 / MGC-1762 — drena también `socialEventPending` (F4).
    case 'clearPostMatch':
      return {
        ...state,
        postMatchPending: null,
        socialEventPending: null,
        nextWeekModifiers: { ...NO_MODIFIERS },
      };
    // MGC-1730 (HIGH-1 fix sobre PR #425) — resuelve `transferState`
    // usando `acceptOffer` o `declineAllOffers`. Si `transferState` es
    // null (no hay temporada cerrada aún), no hace nada. La UI F3.3
    // abre la pantalla de transferencias cuando `transferState?.resolved
    // === false` y llama esta acción con el id aceptado (o null para
    // declinar).
    case 'resolveTransfer': {
      if (!state.transferState) return state;
      const next: TransferState =
        action.acceptedOfferId === null
          ? declineAllOffers(state.transferState)
          : acceptOffer(state.transferState, action.acceptedOfferId);
      return { ...state, transferState: next };
    }
    case 'reset':
      return initialSnapshot();
    default:
      return state;
  }
}

/**
 * Helper compartido (MGC-491) — ejecuta la transición de temporada
 * completa: corre `advanceSeason` con la semilla determinista,
 * acumula stats OP/OG/OA, agrega fila a timeline y eventos al log, y
 * actualiza `stage` a `'retirement'` si el jugador se retira.
 *
 * Es la única vía para que `advance()` (al llegar a week >= 38 con club)
 * y la acción explícita `advanceSeason` produzcan exactamente la misma
 * transición. Sin este helper compartido, los dos paths duplicaban el
 * cálculo de seed + merge del log y un drift accidental entre ellos
 * podría hacer que el botón "Siguiente semana" no acumulara stats
 * mientras "Jugar temporada" sí (ver parent MGC-488).
 *
 * MGC-1730 (HIGH-1 fix sobre PR #425) — el helper ahora también
 * dispara los módulos F3.2 que antes vivían huérfanos:
 *
 *   - `evaluateTransfer` (transfers.ts) — produce el `transferState`
 *     con verdict, ofertas y deadline. La UI F3.3 lo lee y muestra la
 *     pantalla de transferencias; el `resolveTransfer` action lo drena.
 *     Input: avgRating agregado de la temporada recién cerrada + posición
 *     en tabla + posición del jugador. `tablePos` se aproxima con la
 *     inversa del rating promedio: a mayor rating, mejor tabla. Esto es
 *     deliberadamente burdo para F3.2 (la UI lo refinará en F3.3 cuando
 *     conectemos al leaderboard real); lo importante aquí es que el
 *     módulo se ejecuta y deja estado persistible.
 *
 *   - `walkTree` (decision-tree.ts) — produce la traza de outcomes
 *     decisión-a-decisión del árbol de F3.2. Cada paso se loguea como
 *     `CareerEvent` con `kind: 'event'` y `copyId: 'tree_out_<id>'`
 *     para que QA pueda validar replay determinista y la UI pueda
 *     mostrar highlights de la temporada en el timeline.
 *
 * También drenamos `postMatchPending`/`nextWeekModifiers`: el modal
 * post-partido perdió relevancia al cambiar de temporada y los
 * modificadores ya no aplican a la semana 1 de la nueva temporada.
 *
 * Si no hay club asignado, devuelve `state` sin cambios: la temporada
 * no puede cerrarse sin club (no hay partidos que simular, no hay stats
 * que acumular).
 */
export function applySeasonRollover(state: CareerSnapshot): CareerSnapshot {
  if (!state.profile.club) return state;
  const baseSeed = state.seed ?? seedFromString(state.profile.name || 'copero');
  const seed =
    baseSeed +
    state.profile.season * 1009 +
    seedFromString(state.profile.name || 'copero');
  const result = advanceSeason(state.profile, state.profile.club, createRng(seed));

  // MGC-1730 — `walkTree` consume un RNG separado con seed estable
  // (sumamos 3 al seed base para no pisar la secuencia que ya consumió
  // `advanceSeason`). Reproducibilidad: dado el mismo `seed` y la misma
  // posición, la traza es bit-exacta (ver `fase3-events-transfers.test.ts`
  // test "`walkTree` produce historias divergentes con seeds distintos").
  const walkRng = createRng(seed + 3);
  const trace = walkTree(result.profile.position, walkRng);
  const treeEvents: import('@/types/career').CareerEvent[] = trace.map((step, idx) => ({
    season: result.profile.season,
    // MGC-1730 — el `CareerEventKind` no tiene slot específico para el
    // árbol F3.2; reusamos `'match'` que ya carga la prosa de highlights
    // de temporada en la UI. La `copyId: 'tree_out_*'` distingue los
    // eventos del árbol de los partidos reales al resolver copy.
    kind: 'match',
    copyId: step.outcome.copyId,
    values: { node: step.nodeId.split('_').slice(1).join('_'), idx },
  }));

  // MGC-1730 — `evaluateTransfer` se ejecuta con datos agregados de la
  // temporada que acabamos de cerrar. `avgRating` se aproxima del
  // rating de la última matchweek (`career.matchweekStats.goals` +
  // heurística basada en apps). `tablePos` se aproxima con la inversa
  // del OVR final (cap 1..20): OVR >= 90 → 1, OVR <= 60 → 20.
  // Documentado como deliberadamente burdo (ver JSDoc arriba); F3.3
  // refinará cuando conectemos al leaderboard real.
  const transferRng = createRng(seed + 7);
  const totalApps = result.profile.stats.apps;
  const recentGoals = result.profile.career.matchweekStats?.goals ?? 0;
  const avgRating = totalApps > 0
    ? clamp(6 + (result.profile.ovr - 60) / 6 + recentGoals / Math.max(1, totalApps), 4, 10)
    : 6.0;
  const tablePos = clamp(Math.round(20 - ((result.profile.ovr - 60) / 30) * 19), 1, 20);
  const transferInput: TransferInput = {
    avgRating,
    goals: result.profile.stats.goals - (state.profile.stats.goals ?? 0),
    tablePos,
    position: result.profile.position,
    age: result.profile.age,
    season: result.profile.season,
    seasonEndWeek: 38,
    currentClubId: result.profile.club?.id ?? null,
  };
  const transferState = evaluateTransfer(transferInput, transferRng);

  const log = {
    timeline: [...(state.log?.timeline ?? []), result.row],
    events: [...(state.log?.events ?? []), ...result.events, ...treeEvents],
  };
  const stage: CareerStage = isRetired(result.profile) ? 'retirement' : 'season';
  return {
    ...state,
    stage,
    profile: result.profile,
    log,
    postMatchPending: null,
    socialEventPending: null,
    nextWeekModifiers: { ...NO_MODIFIERS },
    transferState,
  };
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/** Mezcla la PlayerCard en el PlayerProfile (MGC-208 §1 + §3). */
function applyCardToProfile(profile: PlayerProfile, card: ReturnType<typeof cardFromPicks>): PlayerProfile {
  const attrs = attrsFromCard(card);
  return {
    ...profile,
    attrs,
    ovr: card.ovrInicial,
    value: card.potencial,
    age: 16,
    season: 1,
    week: 1,
    stats: { apps: 0, goals: 0, ast: 0 },
    career: {
      ...profile.career,
      presupuesto: 0,
      // MGC-1663: pasar por helper para mantener un único punto de mapeo.
      lesion: { kind: 'ninguna', fechasOut: 0, startedAtWeek: 0, affectedAttr: affectedAttrFor('ninguna') },
      reputation: {
        prensa: 'neutral',
        hinchada: 'aceptado',
        vestuario: 'integrado',
        seleccionConvocado: false,
      },
    },
  };
}

/** Helper: ¿el profile tiene los campos mínimos para pasar de identity a dashboard? */
// MGC-1628 / WF1 — espejo del helper liviano en identity-state.ts.
// El motor re-exporta la misma lógica para que las simulaciones y tests
// no tengan que importar el módulo liviano (que arrastra menos, pero
// vive aparte por code-split MGC-543). Mantener ambos sincronizados
// hasta que consolidemos en una sola fuente.
export function isIdentityComplete(profile: PlayerProfile): boolean {
  const firstName = profile.name.trim();
  const lastName = (profile.lastName ?? '').trim();
  const ageValid = profile.age >= 16 && profile.age <= 35;
  const natValid = profile.nationalityCode.trim().length > 0;
  return firstName.length >= 2 && lastName.length >= 2 && ageValid && natValid;
}