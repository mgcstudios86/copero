/**
 * MGC-565 — tests de regresión del ResetCareerButton dev-only.
 *
 * Verifica el contrato público del botón (sin renderizar RN):
 *  1. `shouldRenderResetButton()` devuelve true con env flag.
 *  2. El flow de reset limpia `loadCareerSave()` (integration contract).
 *  3. El reset del store flipea stage a 'identity' tras clear.
 *  4. `ResetCareerButton()` no es null bajo dev.
 *
 * NOTA SOBRE MOCKS:
 *  - `expo-router` se mockea completo porque su entry usa `typeof`
 *    que crashea la SSR transform de vitest.
 *  - `useCareerStore` + `clearCareerSave` se importan REAL — el
 *    store y la persistencia son código bajo test, deben correr.
 */

// Mock react-native Alert.alert (no-op estable para tests donde no
// se renderiza el árbol).
vi.mock('react-native', async () => {
  const actual =
    await vi.importActual<typeof import('react-native')>('./tests/mocks/react-native');
  return {
    ...actual,
    Alert: {
      alert: (
        _title: string,
        _body: string,
        buttons?: Array<{ text?: string; onPress?: () => void; style?: string }>,
      ) => {
        const destructive = buttons?.find((b) => b.style === 'destructive');
        if (destructive?.onPress) destructive.onPress();
      },
    },
  };
});

// Mock expo-router: el entry tiene `typeof` que la SSR transform de
// vitest parsea como TS-only y rompe (mismo problema que MGC-363).
vi.mock('expo-router', () => ({
  useRouter: () => ({ replace: () => undefined, push: () => undefined, back: () => undefined }),
}));

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { useCareerStore, getCareerSnapshot } from '@/shared/store/careerStore';
import {
  loadCareerSave,
  saveCareerSave,
  clearCareerSave,
  __resetStorageForTests,
} from '@/features/career/persistence';
import { initialSnapshot } from '@/features/career/identity-state';
import {
  ResetCareerButton,
  shouldRenderResetButton,
} from '@/features/simulador-carrera/components/ResetCareerButton';

const ENV_FLAG = 'EXPO_PUBLIC_DEV_RESET_CARRERA';

describe('MGC-565 ResetCareerButton', () => {
  beforeEach(async () => {
    __resetStorageForTests();
    delete process.env[ENV_FLAG];
    useCareerStore.getState().reset();
  });

  afterEach(() => {
    delete process.env[ENV_FLAG];
  });

  it('shouldRenderResetButton: false en CI default, true con env flag', () => {
    // Default: el flag no está seteado.
    expect(shouldRenderResetButton()).toBe(false);

    process.env[ENV_FLAG] = '1';
    expect(shouldRenderResetButton()).toBe(true);

    delete process.env[ENV_FLAG];
    expect(shouldRenderResetButton()).toBe(false);
  });

  it('clearCareerSave deja loadCareerSave en null (key canónica borrada)', async () => {
    await saveCareerSave({
      v: 1,
      stage: 'dashboard',
      profile: { ...initialSnapshot().profile, name: 'PreReset' },
      draft: null,
      card: null,
      clubId: null,
      log: { timeline: [], events: [] },
      seed: 1,
    });
    expect(await loadCareerSave()).not.toBeNull();

    await clearCareerSave();
    expect(await loadCareerSave()).toBeNull();
  });

  it('reset del store hidrata desde save puis clear+reset → stage=identity', async () => {
    await saveCareerSave({
      v: 1,
      stage: 'retirement',
      profile: { ...initialSnapshot().profile, name: 'QAPlayer' },
      draft: null,
      card: null,
      clubId: null,
      log: { timeline: [], events: [] },
      seed: 99,
    });
    await useCareerStore.getState().hydrateFromSave();
    expect(useCareerStore.getState().stage).toBe('retirement');

    await clearCareerSave();
    useCareerStore.getState().reset();

    expect(useCareerStore.getState().stage).toBe('identity');
    expect(useCareerStore.getState().profile.name).toBe(
      initialSnapshot().profile.name,
    );
  });

  it('ResetCareerButton() devuelve null cuando el flag no está activo', () => {
    // Sanity: el gate default (sin flag) hace return null.
    expect(ResetCareerButton()).toBeNull();
  });

  it('ResetCareerButton() devuelve árbol JSX cuando el flag está activo', () => {
    process.env[ENV_FLAG] = '1';
    const tree = ResetCareerButton();
    expect(tree).not.toBeNull();
    // El árbol es un elemento React: validar que existe y es truthy.
    // El mock de react-native no expone props del Pressable, así que
    // no inspeccionamos testID acá (se valida en el device vía Maestro).
    expect(tree).toBeTruthy();
    delete process.env[ENV_FLAG];
  });

  it('sanity: snapshot inicial tiene stage=identity', () => {
    useCareerStore.getState().reset();
    const snap = getCareerSnapshot();
    expect(snap.stage).toBe('identity');
    expect(snap.profile.name).toBe(initialSnapshot().profile.name);
  });
});
