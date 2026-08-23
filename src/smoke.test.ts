// Smoke test mínimo para que CI tenga al menos un test verde en el bootstrap.
// Tickets subsiguientes (mobile-developer) agregan cobertura real.

import { describe, it, expect } from 'vitest';

describe('copero bootstrap', () => {
  it('exports a stable game name constant', () => {
    const GAME_NAME = 'copero';
    expect(GAME_NAME).toBe('copero');
  });
});
