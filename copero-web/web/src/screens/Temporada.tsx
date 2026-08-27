import { TIMELINE } from '../data/mock';

export default function Temporada() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      <aside className="space-y-4">
        <section className="card p-5">
          <header className="flex items-center justify-between">
            <span className="font-display text-4xl">70</span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="pill" aria-hidden>🇦🇷</span>
              <span className="pill pill-accent">#10 DELANTERO</span>
              <span className="pill">BOCA JUNIORS</span>
            </div>
          </header>
          <p className="mt-3 text-xs text-copero-muted">
            Argentina · Escenario regional
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="card p-4">
              <p className="field-label">EDAD</p>
              <p className="mt-1 font-display text-2xl">16</p>
            </div>
            <div className="card p-4">
              <p className="field-label">VALOR</p>
              <p className="mt-1 font-display text-2xl text-copero-accent">11 M US$</p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3 text-xs text-copero-muted">
            <span aria-hidden>🧮</span>
            <span>0 M</span>
            <span aria-hidden>⚽</span>
            <span>0 G</span>
            <span aria-hidden>📈</span>
            <span>0 A</span>
          </div>

          <div className="mt-4 card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide">
              SELECCIÓN · ARGENTINA
            </p>
            <p className="mt-1 text-xs text-copero-muted">Sin convocatorias todavía</p>
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs text-copero-muted">
            <span aria-hidden>🏆</span> VITRINA VACÍA
          </div>
        </section>

        <section className="card p-5">
          <p className="label-eyebrow">TU ESTILO DE JUGADOR</p>
          <h2 className="heading-display mt-2 text-2xl">ELEGÍ HASTA 2 RASGOS</h2>
          <p className="mt-1 text-xs text-copero-muted">
            Cambian eventos, ofertas y desarrollo. Seleccioná 1 o 2.
          </p>
          <ul className="mt-3 space-y-2">
            {['Magneto mediático', 'Trotamundos'].map((r) => (
              <li
                key={r}
                className="row-cell justify-between text-sm"
              >
                <span className="font-semibold uppercase tracking-wide">{r.toUpperCase()}</span>
                <span className="pill">0 / 2</span>
              </li>
            ))}
          </ul>
        </section>
      </aside>

      <section className="card p-5 sm:p-6">
        <header className="grid grid-cols-5 gap-3 pb-3 text-[10px] font-mono uppercase tracking-widest text-copero-muted">
          <span>EDAD</span>
          <span className="col-span-2">CLUB</span>
          <span className="text-right">OVR</span>
          <span className="text-right">🧮 ⚽ 📈</span>
        </header>
        <ul className="divide-y divide-copero-border">
          {TIMELINE.concat(
            Array.from({ length: 25 }).map((_, i) => ({
              age: 17 + i,
              club: '—',
              ovr: 0,
              apps: 0,
              goals: 0,
              assists: 0,
            })),
          ).map((row) => (
            <li
              key={row.age}
              className={`grid grid-cols-5 items-center gap-3 py-2 text-sm ${
                row.club === '—' ? 'text-copero-muted' : 'text-copero-text'
              }`}
            >
              <span className="grid h-8 w-8 place-items-center rounded-md border border-copero-border font-mono text-xs">
                {row.age}
              </span>
              <span className="col-span-2 truncate">{row.club}</span>
              <span className="text-right font-mono">
                {row.ovr > 0 ? row.ovr : '—'}
              </span>
              <span className="text-right font-mono text-xs text-copero-muted">
                {row.ovr > 0 ? `${row.apps} / ${row.goals} / ${row.assists}` : '—'}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}