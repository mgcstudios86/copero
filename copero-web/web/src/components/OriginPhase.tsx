import { gameT } from '@shared-i18n/game-copy';
import type { GameLocale } from '@shared-i18n/game-copy';

/**
 * OriginPhase — header de la fase de origen (MGC-232).
 *
 * Espejo web del componente Expo `src/features/simulador-carrera/components/OriginPhase.tsx`.
 * Comparte el mismo módulo de copy (`@shared-i18n/game-copy`), así que el
 * título sigue al catálogo real de clubes en vez de un literal fijo.
 */
export default function OriginPhase({
  count,
  locale,
}: {
  count: number;
  locale?: GameLocale;
}) {
  return (
    <header className="space-y-2">
      <p className="label-eyebrow">{gameT('origin.eyebrow', undefined, locale)}</p>
      <h1 className="heading-display text-3xl sm:text-4xl" data-testid="origin-title">
        {gameT('origin.title', { count }, locale)}
      </h1>
      <p className="max-w-prose text-sm text-copero-muted">
        {gameT('origin.body', undefined, locale)}
      </p>
    </header>
  );
}
