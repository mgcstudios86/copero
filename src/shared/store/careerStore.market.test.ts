/**
 * MGC-552 — Tests de integración del store de mercado-de-pases
 * (PR #662). Cubre las acciones `openMarket` y `confirmPurchase`
 * del `careerStore` que orquesta el flow de 3 pantallas
 * (`/mercado/lista`, `/mercado/detalle`, `/mercado/confirmacion`).
 *
 * Antes estos helpers sólo se ejercitaban desde los screens
 * individuales y desde el módulo puro `features/career/market.ts`.
 * El review de MGC-552 detectó que la suite no cubría el ciclo real
 * sobre el store, así que cualquier regresión en la integración
 * (applyAndPersist, idempotencia de openMarket, balance de
 * presupuesto tras confirmPurchase) pasaba silenciosa hasta QA.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const VIRTUAL_CLUB_ID = 'velez';
const VIRTUAL_CLUB = {
  id: VIRTUAL_CLUB_ID,
  name: 'Vélez',
  league: 'Liga Profesional',
  reputation: 4,
  presupuesto: 50,
  crestColor: '#000',
  crestAccent: '#fff',
} as const;

describe('MGC-552 · openMarket + confirmPurchase (careerStore)', () => {
  beforeEach(async () => {
    const { useCareerStore } = await import('@/shared/store/careerStore');
    useCareerStore.setState((s) => ({
      ...s,
      seed: 123456,
      marketState: null,
      profile: {
        ...s.profile,
        club: VIRTUAL_CLUB,
        clubPresupuesto: VIRTUAL_CLUB.presupuesto,
        ovr: 70,
        season: 1,
      },
    }));
  });

  afterEach(async () => {
    const { useCareerStore } = await import('@/shared/store/careerStore');
    useCareerStore.setState((s) => ({ ...s, marketState: null }));
  });

  it('openMarket() crea un pool con 6-12 jugadores excluyendo el club del manager', async () => {
    const { useCareerStore } = await import('@/shared/store/careerStore');
    const store = useCareerStore.getState();
    await store.openMarket();
    const ms = useCareerStore.getState().marketState;
    expect(ms).not.toBeNull();
    expect(ms?.status).toBe('open');
    expect(ms?.pool.length).toBeGreaterThanOrEqual(6);
    expect(ms?.pool.length).toBeLessThanOrEqual(12);
    expect(ms?.pool.every((p) => p.fromClub.id !== VIRTUAL_CLUB_ID)).toBe(true);
    expect(ms?.pendingOffer).toBeNull();
    expect(ms?.season).toBe(1);
  });

  it('openMarket() es idempotente dentro de la misma temporada', async () => {
    const { useCareerStore } = await import('@/shared/store/careerStore');
    const store = useCareerStore.getState();
    await store.openMarket();
    const firstPool = useCareerStore.getState().marketState?.pool;
    await store.openMarket();
    const secondPool = useCareerStore.getState().marketState?.pool;
    expect(secondPool).toBe(firstPool);
    expect(secondPool?.length).toBeGreaterThan(0);
  });

  it('confirmPurchase() sin pendingOffer devuelve { ok: false, reason: no_offer }', async () => {
    const { useCareerStore } = await import('@/shared/store/careerStore');
    const store = useCareerStore.getState();
    await store.openMarket();
    const result = await store.confirmPurchase();
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('no_offer');
    expect(useCareerStore.getState().profile.clubPresupuesto).toBe(
      VIRTUAL_CLUB.presupuesto,
    );
  });

  it('confirmPurchase() sobre oferta válida descuenta presupuesto y saca al jugador del pool', async () => {
    const { useCareerStore } = await import('@/shared/store/careerStore');
    const store = useCareerStore.getState();
    await store.openMarket();
    const ms = useCareerStore.getState().marketState;
    expect(ms).not.toBeNull();
    // Tomamos el jugador más barato del pool y ofertamos exactamente su
    // valor: la IA acepta ofertas >= valor (probabilidad 1.0 en el helper
    // `evaluatePurchaseOffer`). Sin esto el test podría flakear si la IA
    // rechaza.
    const target = [...(ms?.pool ?? [])].sort((a, b) => a.value - b.value)[0];
    expect(target).toBeDefined();
    const offer = await store.proposePurchase(target.id, target.value);
    expect(offer).not.toBeNull();
    const budgetBefore = useCareerStore.getState().profile.clubPresupuesto;
    const result = await store.confirmPurchase();
    expect(result.ok).toBe(true);
    const after = useCareerStore.getState();
    // El comprador pagó exactamente `target.value`.
    expect(after.profile.clubPresupuesto).toBe(budgetBefore - target.value);
    // El jugador vendido ya no aparece en el pool.
    expect(
      after.marketState?.pool.find((p) => p.id === target.id),
    ).toBeUndefined();
    // El modal cierra: pendingOffer queda null, status vuelve a 'open'.
    expect(after.marketState?.pendingOffer).toBeNull();
    expect(after.marketState?.status).toBe('open');
  });

  it('confirmPurchase() devuelve ia_rejected cuando la oferta es < valor (RNG adverso)', async () => {
    const { useCareerStore } = await import('@/shared/store/careerStore');
    const store = useCareerStore.getState();
    await store.openMarket();
    const ms = useCareerStore.getState().marketState;
    const target = [...(ms?.pool ?? [])].sort((a, b) => b.value - a.value)[0];
    // Oferta del 1% del valor → IA rechaza con probabilidad ~1.
    const lowOffer = Math.max(1, Math.floor(target.value * 0.01));
    await store.proposePurchase(target.id, lowOffer);
    const budgetBefore = useCareerStore.getState().profile.clubPresupuesto;
    const result = await store.confirmPurchase();
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('ia_rejected');
    // El presupuesto NO se toca cuando la IA rechaza.
    expect(useCareerStore.getState().profile.clubPresupuesto).toBe(
      budgetBefore,
    );
    // El jugador sigue en el pool para re-ofertar.
    expect(
      useCareerStore.getState().marketState?.pool.find((p) => p.id === target.id),
    ).toBeDefined();
  });
});
