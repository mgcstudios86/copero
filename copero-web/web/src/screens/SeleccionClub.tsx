import { Link } from 'react-router-dom';
import { CLUBS, OVR_INICIAL, POTENCIAL } from '../data/mock';
import OriginPhase from '../components/OriginPhase';

const colorMap: Record<'green' | 'amber' | 'rose', string> = {
  green: 'text-copero-accent',
  amber: 'text-copero-amber',
  rose: 'text-copero-rose',
};

export default function SeleccionClub() {
  return (
    <div className="space-y-6">
      <OriginPhase count={CLUBS.length} />

      <div className="rounded-copero border border-copero-accent/40 bg-copero-accent/5 p-4">
        <p className="field-label">TU PERFIL</p>
        <p className="mt-1 font-display text-xl">
          OVR {OVR_INICIAL} · POT {POTENCIAL}
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {CLUBS.map((club) => (
          <article key={club.id} className="card relative overflow-hidden p-5">
            <header className="flex items-center gap-3">
              <span
                aria-hidden
                className="grid h-10 w-10 place-items-center rounded-full font-display text-sm text-white"
                style={{ backgroundColor: club.crestColor }}
              >
                {club.name.slice(0, 1)}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`pill ${
                    club.archetype === 'AMBICIÓN'
                      ? 'pill-amber'
                      : club.archetype === 'EQUILIBRIO'
                        ? ''
                        : 'pill-accent'
                  }`}
                >
                  {club.archetype}
                </span>
                <span className="pill">REPUTACIÓN {club.reputation}/5</span>
              </div>
            </header>

            <h2 className="heading-display mt-4 text-xl">{club.name.toUpperCase()}</h2>
            <p className="text-xs text-copero-muted">
              Liga Profesional · Rol probable: Titular
            </p>

            <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
              <div>
                <dt className="field-label">MINUTOS</dt>
                <dd className={`mt-1 font-display text-sm ${colorMap[club.minutesColor]}`}>
                  {club.minutesLabel}
                </dd>
              </div>
              <div>
                <dt className="field-label">CRECIMIENTO</dt>
                <dd className="mt-1 font-display text-sm text-copero-accent">
                  {club.growthLabel}
                </dd>
              </div>
              <div>
                <dt className="field-label">TÍTULOS</dt>
                <dd className="mt-1 font-display text-sm text-copero-amber">
                  {club.titlesLabel}
                </dd>
              </div>
              <div>
                <dt className="field-label">RIESGO</dt>
                <dd className="mt-1 font-display text-sm text-copero-text">
                  {club.riskLabel}
                </dd>
              </div>
            </dl>

            <Link
              to="/temporada"
              className="btn-primary mt-5 w-full"
              aria-label={`Firmar con ${club.name}`}
            >
              Firmar con {club.name}
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}