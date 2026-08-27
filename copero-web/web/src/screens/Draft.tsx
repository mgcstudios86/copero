import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LEGENDS, type Legend } from '../data/mock';

const SLOTS = ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY', 'SKL', 'WF'] as const;

export default function Draft() {
  const [round, setRound] = useState(1);
  const [legendIdx, setLegendIdx] = useState(0);
  const [swapsLeft, setSwapsLeft] = useState(5);
  const [picks, setPicks] = useState<Record<string, string>>({}); // slot -> legend name
  const totalRounds = 8;
  const legend = LEGENDS[legendIdx] as Legend;

  function pickBest() {
    setPicks((prev) => ({ ...prev, [legend.best.key]: legend.name }));
    if (round < totalRounds) {
      setRound((r) => r + 1);
      setLegendIdx((i) => (i + 1) % LEGENDS.length);
    }
  }

  function changeLegend() {
    if (swapsLeft <= 0) return;
    setSwapsLeft((s) => s - 1);
    setLegendIdx((i) => (i + 1) % LEGENDS.length);
  }

  const finished = Object.keys(picks).length >= totalRounds;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-eyebrow">LEGEND ATTRIBUTE DRAFT</p>
          <h1 className="heading-display mt-1 text-4xl sm:text-5xl">
            RONDA {round} DE {totalRounds}
          </h1>
          <p className="mt-2 max-w-prose text-sm text-copero-muted">
            Cada leyenda puede aportar un solo atributo. Los atributos confirmados quedan
            bloqueados.
          </p>
        </div>
        <span className="pill pill-accent">CLASSIC · {swapsLeft} CAMBIOS</span>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <article className="card relative overflow-hidden p-5 sm:p-6">
          <header className="flex items-start justify-between">
            <div>
              <p className="pill">
                <span aria-hidden>🏳️</span> {legend.country} · {legend.years}
              </p>
              <h2 className="heading-display mt-3 text-3xl sm:text-4xl">
                {legend.name.toUpperCase()}
              </h2>
              <p className="mt-1 text-xs uppercase tracking-widest text-copero-muted">
                {legend.positions.join(' · ')}
              </p>
            </div>
            <span
              className={`grid h-12 w-12 place-items-center rounded-md text-lg font-display ${
                legend.badgeColor === 'amber'
                  ? 'bg-copero-amber/20 text-copero-amber'
                  : legend.badgeColor === 'rose'
                    ? 'bg-copero-rose/20 text-copero-rose'
                    : 'bg-copero-accent/20 text-copero-accent'
              }`}
              aria-hidden
            >
              {legend.initials}
            </span>
          </header>

          <div className="mt-5 grid grid-cols-4 gap-3">
            {legend.attributes.map((a) => (
              <div key={a.key} className="tile text-center">
                <p className="text-[10px] font-mono uppercase tracking-widest text-copero-muted">
                  {a.key}
                </p>
                <p
                  className={`mt-1 font-display text-2xl ${
                    a.key === legend.best.key ? 'text-copero-accent' : 'text-copero-text'
                  }`}
                >
                  {a.value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-3">
            {legend.skills.map((s) => (
              <div key={s.key} className="tile flex-1 text-center">
                <p className="text-[10px] font-mono uppercase tracking-widest text-copero-muted">
                  {s.key}
                </p>
                <p className="mt-1 font-display text-2xl text-copero-amber">
                  {s.value}★
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-copero border border-copero-accent/40 bg-copero-accent/5 p-4">
            <p className="label-eyebrow">MEJOR ATRIBUTO DISPONIBLE</p>
            <div className="mt-2 flex items-center justify-between">
              <p className="font-display text-2xl">
                {legend.best.key} · {legend.best.value}
              </p>
              <span className="pill pill-accent">{legend.best.key}</span>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={pickBest}
              className="btn-primary"
              disabled={finished}
            >
              Confirmar atributo
            </button>
            <button
              type="button"
              onClick={changeLegend}
              className="btn-secondary"
              disabled={swapsLeft <= 0}
            >
              Cambiar leyenda · {swapsLeft}
            </button>
          </div>
        </article>

        <aside className="card p-5 sm:p-6">
          <header className="flex items-center justify-between">
            <p className="label-eyebrow">TU JUGADOR</p>
            <span className="pill">DELANTERO</span>
          </header>
          <p className="mt-2 font-display text-2xl uppercase">CALVO</p>

          <ul className="mt-4 space-y-2">
            {SLOTS.map((slot) => {
              const filled = picks[slot];
              return (
                <li
                  key={slot}
                  className="row-cell justify-between"
                  aria-label={`Atributo ${slot}`}
                >
                  <span className="pill w-14 justify-center">{slot}</span>
                  <span className="flex-1 text-sm">
                    {filled ? (
                      <span className="text-copero-text">{filled}</span>
                    ) : (
                      <span className="text-copero-muted">Sin elegir</span>
                    )}
                  </span>
                  <span aria-hidden className="text-copero-muted">—</span>
                </li>
              );
            })}
          </ul>

          <Link
            to="/draft/complete"
            className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
              finished
                ? 'bg-copero-accent text-copero-bg shadow-glow'
                : 'border border-copero-border text-copero-muted'
            }`}
            aria-disabled={!finished}
          >
            {finished ? 'Ver resumen' : 'Volver a identidad y reiniciar draft'}
            <span aria-hidden>→</span>
          </Link>
        </aside>
      </div>
    </div>
  );
}