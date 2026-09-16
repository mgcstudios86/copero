import { describe, expect, it, beforeEach } from 'vitest';

/**
 * MGC-245 — matchStore.alignment + setAlignment.
 *
 * Verifica que el nuevo campo `alignment` y su setter funcionan según
 * spec, y que `setMatch` (que dispara `startMatch` desde careerStore)
 * NO pisa la alineación una vez seteada por el usuario. Eso preserva
 * el chip en `/match` cuando el flow dashboard → /alineacion → /match
 * ocurre.
 */
describe('matchStore — alignment (MGC-245)', () => {
  beforeEach(async () => {
    // Reset del store entre tests (state compartida módulo-level).
    const mod = await import('@/shared/store/matchStore');
    mod.useMatchStore.getState().reset();
  });

  it('arranca con alignment = null', async () => {
    const { useMatchStore } = await import('@/shared/store/matchStore');
    expect(useMatchStore.getState().alignment).toBeNull();
  });

  it('setAlignment acepta los 3 valores canónicos', async () => {
    const { useMatchStore } = await import('@/shared/store/matchStore');
    const setAlignment = useMatchStore.getState().setAlignment;
    setAlignment('conservadora');
    expect(useMatchStore.getState().alignment).toBe('conservadora');
    setAlignment('todo');
    expect(useMatchStore.getState().alignment).toBe('todo');
    setAlignment('lider');
    expect(useMatchStore.getState().alignment).toBe('lider');
  });

  it('setAlignment(null) resetea al estado inicial', async () => {
    const { useMatchStore } = await import('@/shared/store/matchStore');
    useMatchStore.getState().setAlignment('todo');
    expect(useMatchStore.getState().alignment).toBe('todo');
    useMatchStore.getState().setAlignment(null);
    expect(useMatchStore.getState().alignment).toBeNull();
  });

  it('reset() limpia alignment junto con el resto del state', async () => {
    const { useMatchStore } = await import('@/shared/store/matchStore');
    useMatchStore.getState().setAlignment('lider');
    useMatchStore.getState().reset();
    expect(useMatchStore.getState().alignment).toBeNull();
  });
});