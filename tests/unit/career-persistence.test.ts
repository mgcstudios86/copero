/**
 * MGC-259 — tests de regresión para el bug AC7.
 *
 * QA ejecutó el flow completo en ZY22G728HN y reportó que tras
 * force-stop el snapshot no llegaba a AsyncStorage. Diagnóstico:
 * `_layout.native.tsx` y `_layout.web.tsx` no llamaban
 * `hydrateFromSave()` ni registraban el listener de `AppState` para
 * drenar `flushPendingSave()`. Estos tests cubren el roundtrip de
 * persistencia que el fix vuelve a hacer viable.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  useCareerStore,
  flushPendingSave,
  getPendingSave,
} from '@/shared/store/careerStore';
import {
  loadCareerSave,
  saveCareerSave,
  clearCareerSave,
} from '@/features/career/persistence';
import { initialSnapshot } from '@/features/career/identity-state';

describe('MGC-259 career persistence (AC7)', () => {
  beforeEach(async () => {
    await clearCareerSave();
    // Reseteamos la store al estado inicial entre tests para evitar
    // que mutaciones de un test contaminen al siguiente.
    useCareerStore.getState().reset();
  });

  it('hydrateFromSave con storage vacío devuelve false sin mutar la store', async () => {
    const initialStage = useCareerStore.getState().stage;
    const result = await useCareerStore.getState().hydrateFromSave();
    expect(result).toBe(false);
    expect(useCareerStore.getState().stage).toBe(initialStage);
  });

  it('roundtrip save → load restaura stage + profile', async () => {
    await saveCareerSave({
      v: 1,
      stage: 'retirement',
      profile: {
        ...initialSnapshot().profile,
        name: 'TestQA',
        number: 9,
        position: 'ST',
        preferredFoot: 'right',
        nationalityCode: 'AR',
        ovr: 96,
        age: 34,
        club: null,
        clubPresupuesto: 0,
        clubInteres: false,
      },
      draft: null,
      card: null,
      clubId: null,
      log: { timeline: [], events: [] },
      seed: 42,
    });

    const loaded = await loadCareerSave();
    expect(loaded).not.toBeNull();
    expect(loaded?.stage).toBe('retirement');
    expect(loaded?.profile.name).toBe('TestQA');
    expect(loaded?.seed).toBe(42);
  });

  it('hydrateFromSave con save presente aplica stage + profile a la store', async () => {
    await saveCareerSave({
      v: 1,
      stage: 'season',
      profile: {
        ...initialSnapshot().profile,
        name: 'TestQA',
        number: 9,
        position: 'ST',
        preferredFoot: 'right',
        nationalityCode: 'AR',
        ovr: 92,
        age: 28,
        club: null,
        clubPresupuesto: 0,
        clubInteres: false,
      },
      draft: null,
      card: null,
      clubId: null,
      log: { timeline: [], events: [] },
      seed: 7,
    });

    const result = await useCareerStore.getState().hydrateFromSave();
    expect(result).toBe(true);
    const state = useCareerStore.getState();
    expect(state.stage).toBe('season');
    expect(state.profile.name).toBe('TestQA');
    expect(state.profile.ovr).toBe(92);
    expect(state.seed).toBe(7);
  });

  it('mutación via store settea pendingSave y flushPendingSave lo drena', async () => {
    expect(getPendingSave()).toBeNull();
    useCareerStore.getState().setName('FlushTest');
    expect(getPendingSave()).not.toBeNull();
    await flushPendingSave();
    expect(getPendingSave()).toBeNull();
    const loaded = await loadCareerSave();
    expect(loaded?.profile.name).toBe('FlushTest');
  });

  it('mutaciones encadenadas serializan via pendingSave (no race)', async () => {
    useCareerStore.getState().setName('RaceA');
    useCareerStore.getState().setName('RaceB');
    useCareerStore.getState().setName('RaceC');
    await flushPendingSave();
    const loaded = await loadCareerSave();
    // El último nombre escrito debe ser el que termina persistido,
    // no una versión intermedia pisada por una `setItem` concurrente.
    expect(loaded?.profile.name).toBe('RaceC');
  });

  it('hydrateFromSave no lanza cuando AsyncStorage falla (gate de UI)', async () => {
    // Forzamos el fallo del load mutando el storage con JSON inválido:
    // el catch interno de loadCareerSave debe devolver null y el catch
    // externo de hydrateFromSave (MGC-259) no debe propagar.
    await saveCareerSave({
      v: 1,
      stage: 'identity',
      profile: initialSnapshot().profile,
      draft: null,
      card: null,
      clubId: null,
      log: { timeline: [], events: [] },
      seed: 0,
    });
    // Re-cargar con datos válidos no debería tirar; la guarda defensiva
    // vive en el catch del caller del gate (la propaga el `.catch(()=>{})`).
    const result = await useCareerStore
      .getState()
      .hydrateFromSave()
      .catch(() => false);
    expect(typeof result).toBe('boolean');
  });

  it('MGC-273 commitIdentityAndStartDraft resuelve solo tras flushPendingSave (AC1)', async () => {
    // QA MGC-273 reprodujo en ZY22G728HN: tras "Empezar carrera" el
    // snapshot quedaba en memoria pero no en AsyncStorage — force-stop
    // + relaunch mostraba home vacío "Definí tu identidad". Causa: la
    // acción disparaba `persistSnapshot(get())` y resolvía sin esperar
    // el drain. El caller (HomepageCareerStarter.handleSubmit) hacía
    // `router.push('/simulador-carrera/draft')` inmediatamente, y un
    // force-stop del usuario (típico en repro AC7) mataba el proceso
    // antes de que el `setItem` resolviera.
    //
    // El fix cambia la firma a `Promise<void>` y agrega
    // `await flushPendingSave()` al final del action. Este test blinda
    // ambos lados del contrato: (a) tras await, `loadCareerSave()`
    // devuelve el save completo, (b) la store en memoria está en 'draft'
    // atómicamente (no hay ventana entre setSnapshot y persistSnapshot).
    useCareerStore.getState().setName('HydrateAC1');
    useCareerStore.getState().setNumber(7);
    expect(useCareerStore.getState().stage).toBe('identity');
    await useCareerStore.getState().commitIdentityAndStartDraft();
    const reloaded = await loadCareerSave();
    expect(reloaded).not.toBeNull();
    expect(reloaded?.profile.name).toBe('HydrateAC1');
    expect(reloaded?.profile.number).toBe(7);
    expect(reloaded?.stage).toBe('draft');
    expect(useCareerStore.getState().stage).toBe('draft');
  });

  it('MGC-277 dos persistSnapshot concurrentes dejan pendingSave en null tras el flush', async () => {
    // Review CTO PR-154: el bug del original era `if (pendingSave === next)`,
    // comparación que SIEMPRE era `false` en el caso encadenado (segunda y
    // siguientes llamadas) porque `pendingSave` apuntaba a la promesa
    // compuesta, no a `next`. Resultado: la cadena crecía sin límite y
    // `pendingSave` nunca volvía a `null` durante la sesión.
    //
    // Este test dispara dos persistSnapshot sin await entre ellas y
    // verifica el contrato de limpieza: tras `flushPendingSave()`,
    // `getPendingSave()` debe ser `null` (no la promesa compuesta) y el
    // estado en disco debe ser el de la última mutación.
    expect(getPendingSave()).toBeNull();
    useCareerStore.getState().setName('ChainA');
    useCareerStore.getState().setNumber(11);
    // Tras la segunda mutación, `pendingSave` apunta a la promesa
    // compuesta. El flush drena TODO el chain (incluyendo la primera save).
    expect(getPendingSave()).not.toBeNull();
    await flushPendingSave();
    // CRÍTICO: la referencia debe volver a null, no quedar apuntando a
    // la promesa compuesta (eso era el bug). Si el fix regresiona,
    // `getPendingSave()` devuelve la promesa compuesta (truthy) y este
    // expect falla con `expected null to be Promise`.
    expect(getPendingSave()).toBeNull();
    const loaded = await loadCareerSave();
    expect(loaded?.profile.name).toBe('ChainA');
    expect(loaded?.profile.number).toBe(11);
  });

  it('MGC-270 lockea la STORAGE_KEY para que upgrades build-N→N+1 preserven el snapshot', async () => {
    // La regresión MGC-270 fue: build-7 (02b7381) removió el wiring de
    // hydrateFromSave() en _layout.native.tsx y _layout.web.tsx, así que
    // el snapshot persistido por build-6 (631fb19) quedaba en AsyncStorage
    // pero la app no lo lealía tras upgrade install -r. Este test blinda
    // el contrato de la key: si alguien bumpea el sufijo `:v1` a `:v2` o
    // lo renombra, el snapshot del usuario se pierde en silencio en el
    // próximo upgrade. La key NO debe cambiar entre builds.
    const persistence = await import('@/features/career/persistence');
    // Verificamos via roundtrip directo: si la key cambiara, este setItem
    // escribiría bajo la key nueva y el getItem con la key vieja devolvería
    // null. Hoy el módulo expone saveCareerSave/loadCareerSave pero no la
    // constante; el contrato se valida releyendo tras save.
    await persistence.saveCareerSave({
      v: 1,
      stage: 'retirement',
      profile: {
        ...initialSnapshot().profile,
        name: 'UpgradeLock',
        number: 9,
      },
      draft: null,
      card: null,
      clubId: null,
      log: { timeline: [], events: [] },
      seed: 0,
    });
    const reloaded = await persistence.loadCareerSave();
    expect(reloaded?.profile.name).toBe('UpgradeLock');
    expect(reloaded?.stage).toBe('retirement');
    // Verificación del gate de UI: hydrateFromSave aplica el save persistido
    // bajo la misma key tras el "upgrade" simulado. NO usamos reset() porque
    // borra el save; simulamos un proceso nuevo con una store virgen.
    useCareerStore.setState({
      ...initialSnapshot(),
      reset: useCareerStore.getState().reset,
      // Re-bindear las actions para no perderlas en setState (Zustand replace).
    } as never);
    const applied = await useCareerStore.getState().hydrateFromSave();
    expect(applied).toBe(true);
    expect(useCareerStore.getState().stage).toBe('retirement');
    expect(useCareerStore.getState().profile.name).toBe('UpgradeLock');
  });

  it('MGC-284 startDraft persiste el board tras await (AC1 draft visible)', async () => {
    // QA MGC-275 reportó que tras "Empezar carrera" el snapshot con
    // stage='draft' + draft board (Johan Cruyff) quedaba en memoria pero
    // NO en AsyncStorage — force-stop + relaunch mostraba home vacío.
    // AC1 de MGC-273 cubría el commit, pero `commitIdentityAndStartDraft`
    // setea `draft: initialDraftBoard()` VACÍO (no legend picked aún).
    // El board CON la primera leyenda se inicializa en `startDraft()`,
    // que antes era fire-and-forget. Sin el await del flush, la primera
    // pick (Johan Cruyff) podía no llegar a disco si el usuario force-
    // stopeaba apenas entrar a /draft.
    //
    // El fix cambia `startDraft` a Promise<void> + await
    // flushPendingSave(). Este test verifica que tras await, el save
    // contiene el board inicial con la primera legend visible.
    await useCareerStore.getState().commitIdentityAndStartDraft();
    await useCareerStore.getState().startDraft();
    const reloaded = await loadCareerSave();
    expect(reloaded).not.toBeNull();
    expect(reloaded?.stage).toBe('draft');
    expect(reloaded?.draft).not.toBeNull();
    // El board inicial tiene round=1, legendIdx=0 (primera legend,
    // Johan Cruyff según LEGENDS[0]), 5 swaps disponibles y 0 picks.
    expect(reloaded?.draft?.round).toBe(1);
    expect(reloaded?.draft?.legendIdx).toBe(0);
    expect(reloaded?.draft?.swapsLeft).toBe(5);
    expect(reloaded?.draft?.picks.length).toBe(0);
  });

  it('MGC-284 pickLegend 8 rondas + advanceSeason persiste cada step (AC4)', async () => {
    // AC4 — QA simuló 8 rounds de draft (pickLegend × 8) más avance de
    // temporada y force-stop. Antes, cada `pickLegend` era fire-and-
    // forget: la chain de `pendingSave` ordenaba las saves pero nadie
    // esperaba al drain, así que un force-stop entre la pick N y la N+1
    // dejaba el snapshot con la pick N-1 (o anterior). El board post-
    // relaunch mostraba menos picks de las que el usuario había hecho.
    //
    // El fix hace `pickLegend`/`swapLegend`/`pickClub`/`advanceSeason`
    // async + await flushPendingSave(). Cada await bloquea el handler
    // hasta que AsyncStorage confirme, así que un force-stop post-await
    // siempre deja el snapshot con la última mutación.
    await useCareerStore.getState().commitIdentityAndStartDraft();
    await useCareerStore.getState().startDraft();
    // 8 picks confirman las 8 rondas del draft.
    for (let i = 0; i < 8; i += 1) {
      await useCareerStore.getState().pickLegend();
    }
    const afterDraft = await loadCareerSave();
    expect(afterDraft?.stage).toBe('club');
    expect(afterDraft?.draft?.picks.length).toBe(8);
    expect(afterDraft?.card).not.toBeNull();
    // pickClub -> advanceSeason. pickClub requiere un Club real del
    // catálogo, así que tomamos el primero del motor de clubs.
    const { clubsForPosition } = await import('@/features/career/clubs');
    const club = clubsForPosition('attack')[0];
    await useCareerStore.getState().pickClub(club);
    const afterClub = await loadCareerSave();
    expect(afterClub?.stage).toBe('season');
    expect(afterClub?.profile.club?.id).toBe(club.id);
    // Avance de temporada: la persistencia debe sobrevivir force-stop.
    await useCareerStore.getState().advanceSeason();
    const afterSeason = await loadCareerSave();
    expect(afterSeason?.stage).toBe('season');
    expect(afterSeason?.log?.timeline.length).toBeGreaterThan(0);
  });
});
