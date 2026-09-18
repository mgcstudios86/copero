/**
 * MGC-475 — Tests del módulo mercado-de-pases.
 *
 * Cubre: generación del pool (cantidad + dedupe), filtro, evaluatePurchaseOffer
 * (probabilidad por ratio valor/oferta), applyAcceptedPurchase (reglas de
 * presupuesto).
 *
 * No cubre la UI: eso lo cubren Maestro E2E (delegado a QA).
 */

import { describe, expect, it } from 'vitest';
import {
  applyAcceptedPurchase,
  evaluatePurchaseOffer,
  filterMarketPool,
  findMarketPlayer,
  generateMarketPool,
} from '@/features/career/market';
import { createRng } from '@/features/career/rng';

const rng = () => createRng(123456);

describe('MGC-475 — market module', () => {
  it('genera un pool con 6-12 jugadores excluyendo el club del manager', () => {
    const pool = generateMarketPool(rng(), { seed: 42, excludeClubId: 'velez' });
    expect(pool.length).toBeGreaterThanOrEqual(6);
    expect(pool.length).toBeLessThanOrEqual(12);
    expect(pool.every((p) => p.fromClub.id !== 'velez')).toBe(true);
  });

  it('ordena el pool por OVR descendente', () => {
    const pool = generateMarketPool(rng(), { seed: 99 });
    for (let i = 1; i < pool.length; i += 1) {
      expect(pool[i - 1].ovr).toBeGreaterThanOrEqual(pool[i].ovr);
    }
  });

  it('asigna posiciones válidas por grupo', () => {
    const pool = generateMarketPool(rng(), { seed: 7 });
    const positions = new Set(pool.map((p) => p.position));
    expect(positions.size).toBeGreaterThan(1);
  });

  it('filtra por posición / precio / edad / club', () => {
    const pool = generateMarketPool(rng(), { seed: 5 });
    const filteredByPos = filterMarketPool(pool, { position: 'ST' });
    expect(filteredByPos.every((p) => p.position === 'ST')).toBe(true);

    const filteredByPrice = filterMarketPool(pool, { maxPrice: 1 });
    expect(filteredByPrice.every((p) => p.value <= 1)).toBe(true);

    const filteredByAge = filterMarketPool(pool, { maxAge: 20 });
    expect(filteredByAge.every((p) => p.age <= 20)).toBe(true);
  });

  it('findMarketPlayer devuelve el target o null', () => {
    const pool = generateMarketPool(rng(), { seed: 11 });
    expect(findMarketPlayer(pool, pool[0].id)?.id).toBe(pool[0].id);
    expect(findMarketPlayer(pool, 'no-existe')).toBeNull();
  });

  it('evaluatePurchaseOffer rechaza ofertas muy bajas casi siempre', () => {
    // Ratio 0.5x → -0.4 base → p ~ 0.05..0.3 → mayoría rechazos.
    let accepted = 0;
    for (let i = 0; i < 50; i += 1) {
      const r = evaluatePurchaseOffer({
        offeredAmount: 5,
        marketValue: 10,
        sellingClubReputation: 3,
        buyerClubOvr: 70,
        playerOvr: 70,
        rng: createRng(i + 1),
      });
      if (r) accepted += 1;
    }
    expect(accepted).toBeLessThan(20);
  });

  it('evaluatePurchaseOffer acepta ofertas paritarias o sobrevaloradas más seguido', () => {
    // Ratio 1.5x → +0.3 base → p ~ 0.75..0.95 → mayoría acepta.
    let accepted = 0;
    for (let i = 0; i < 50; i += 1) {
      const r = evaluatePurchaseOffer({
        offeredAmount: 15,
        marketValue: 10,
        sellingClubReputation: 5,
        buyerClubOvr: 70,
        playerOvr: 70,
        rng: createRng(i + 100),
      });
      if (r) accepted += 1;
    }
    expect(accepted).toBeGreaterThan(20);
  });

  it('applyAcceptedPurchase descuenta presupuesto y devuelve el jugador', () => {
    const pool = generateMarketPool(rng(), { seed: 21 });
    const target = pool[0];
    const offer = {
      id: `offer_${target.id}`,
      playerId: target.id,
      amount: target.value,
      verdict: 'pending' as const,
      playerSnapshot: target,
    };
    // Budget debe superar el value real del pool (Boca/River rep=5 → OVR
    // 86-90 → value hasta ~161 M EUR). Usamos target.value + margen para
    // mantener el test determinista sin acoplarse al catálogo de clubes.
    const startingBudget = target.value + 50;
    const result = applyAcceptedPurchase({
      offer,
      currentBudget: startingBudget,
      currentPool: pool,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.newBudget).toBe(startingBudget - target.value);
      expect(result.player.id).toBe(target.id);
    }
  });

  it('applyAcceptedPurchase rechaza presupuesto insuficiente', () => {
    const pool = generateMarketPool(rng(), { seed: 22 });
    const target = pool[0];
    const offer = {
      id: `offer_${target.id}`,
      playerId: target.id,
      amount: target.value,
      verdict: 'pending' as const,
      playerSnapshot: target,
    };
    const result = applyAcceptedPurchase({
      offer,
      currentBudget: 0,
      currentPool: pool,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('insufficient_budget');
  });

  it('applyAcceptedPurchase rechaza jugador ya vendido en background', () => {
    const pool = generateMarketPool(rng(), { seed: 23 });
    const target = pool[0];
    const offer = {
      id: `offer_${target.id}`,
      playerId: target.id,
      amount: target.value,
      verdict: 'pending' as const,
      playerSnapshot: target,
    };
    const result = applyAcceptedPurchase({
      offer,
      currentBudget: 100,
      currentPool: [], // pool vaciado por venta en otra sesión
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('player_unavailable');
  });
});