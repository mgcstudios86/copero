import { describe, expect, it } from 'vitest';
import { createRng } from './rng';
import {
  acceptOffer,
  declineAllOffers,
  evaluateTransfer,
  type TransferInput,
  type TransferState,
} from './transfers';

/**
 * MGC-1803 — TR1 acceptance: motor produces ≥2 ofertas si overall ≥ 6.0.
 *
 * El motor `transfers.ts` ya tiene cobertura exhaustiva en
 * `fase3-events-transfers.test.ts`. Este test agrega el AC específico
 * del wire UX: "≥ 2 ofertas visibles si stat overall ≥ 6.0".
 *
 * Para `avgRating >= 7.4` con criterio secundario cumplido, el veredicto
 * es `strong_offers` (2 ofertas). Para `avgRating >= 8.0` con criterio
 * secundario cumplido, es `elite_offers` (3 ofertas). El AC pide ≥ 2,
 * por lo que ambos veredictos lo cumplen.
 */
describe('MGC-1803 — TR1 acceptance: motor produces ≥2 ofertas', () => {
  const base = (over: Partial<TransferInput> = {}): TransferInput => ({
    avgRating: 7.5,
    goals: 12,
    tablePos: 5,
    position: 'ST',
    age: 24,
    season: 1,
    seasonEndWeek: 38,
    currentClubId: 'racing',
    ...over,
  });

  it('strong_offers produce exactamente 2 ofertas', () => {
    // avgRating 7.5 + goals 12 (>= 10) → strong_offers → 2 ofertas.
    const state = evaluateTransfer(
      base({ avgRating: 7.5, goals: 12, position: 'ST', tablePos: 5 }),
      createRng(7),
    );
    expect(state.verdict).toBe('strong_offers');
    expect(state.offers).toHaveLength(2);
  });

  it('elite_offers produce exactamente 3 ofertas (cumple AC ≥ 2)', () => {
    // avgRating 8.5 + goals 18 (>= 15) → elite_offers → 3 ofertas.
    const state = evaluateTransfer(
      base({ avgRating: 8.5, goals: 18, position: 'ST', tablePos: 2 }),
      createRng(7),
    );
    expect(state.verdict).toBe('elite_offers');
    expect(state.offers.length).toBeGreaterThanOrEqual(2);
  });

  it('hold/hold_low pueden no tener ofertas (fallback aplica)', () => {
    // avgRating 7.1 + tablePos 12 → hold. Por la mecánica del motor,
    // puede haber 0 o 1 oferta. Si 0, no se muestra la pantalla.
    // Verificamos que el AC "≥ 2 ofertas" NO se exige en estos buckets.
    for (let seed = 0; seed < 20; seed += 1) {
      const state = evaluateTransfer(
        base({ avgRating: 7.1, tablePos: 12, goals: 5 }),
        createRng(seed),
      );
      if (state.verdict === 'hold' || state.verdict === 'hold_low') {
        expect(state.offers.length).toBeLessThanOrEqual(1);
      }
    }
  });

  it('descent_risk fuerza 1 oferta (forcedTransfer=true)', () => {
    // avgRating 4 + tablePos 18 → descent_risk → 1 oferta + forcedTransfer.
    const state = evaluateTransfer(
      base({ avgRating: 4, tablePos: 18, goals: 2 }),
      createRng(7),
    );
    expect(state.verdict).toBe('descent_risk');
    expect(state.forcedTransfer).toBe(true);
    expect(state.offers).toHaveLength(1);
  });

  it('retirement NO genera ofertas (lo toma retirement.ts)', () => {
    const state = evaluateTransfer(base({ age: 35 }), createRng(7));
    expect(state.verdict).toBe('retirement');
    expect(state.offers).toHaveLength(0);
  });

  it('acceptOffer persiste acceptedOfferId y resolved=true', () => {
    const state: TransferState = evaluateTransfer(
      base({ avgRating: 7.5, goals: 12 }),
      createRng(7),
    );
    expect(state.resolved).toBe(false);
    expect(state.acceptedOfferId).toBeNull();

    const accepted = acceptOffer(state, state.offers[0].id);
    expect(accepted.resolved).toBe(true);
    expect(accepted.acceptedOfferId).toBe(state.offers[0].id);

    // Inmutable: el estado original no fue mutado.
    expect(state.resolved).toBe(false);
    expect(state.acceptedOfferId).toBeNull();
  });

  it('declineAllOffers persiste resolved=true con acceptedOfferId=null (fallback club actual)', () => {
    const state = evaluateTransfer(
      base({ avgRating: 7.5, goals: 12 }),
      createRng(7),
    );
    const declined = declineAllOffers(state);
    expect(declined.resolved).toBe(true);
    expect(declined.acceptedOfferId).toBeNull();
  });

  it('acceptOffer con id inexistente devuelve resolved=false (señal explícita)', () => {
    // MGC-1730 fix: antes retornaba misma referencia; ahora clona con
    // resolved=false → caller sabe que no se aceptó.
    const state = evaluateTransfer(
      base({ avgRating: 7.5, goals: 12 }),
      createRng(7),
    );
    const result = acceptOffer(state, 'offer_inexistente_99');
    expect(result.resolved).toBe(false);
    expect(result.acceptedOfferId).toBeNull();
    // Garantiza nueva referencia, no aliasing silencioso.
    expect(result).not.toBe(state);
  });
});
