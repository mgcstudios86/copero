import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  NATIONALITIES,
  POSITION_LABEL,
  type Position,
} from '../data/mock';

const POSITIONS: Position[] = ['ST', 'CAM', 'CM', 'LW', 'RW', 'CB', 'LB', 'RB', 'GK'];

export default function Identidad() {
  const [surname, setSurname] = useState('Tu apellido');
  const [number, setNumber] = useState(10);
  const [foot, setFoot] = useState<'Izquierda' | 'Derecha'>('Derecha');
  const [nationality, setNationality] = useState('Argentina');
  const [position, setPosition] = useState<Position>('ST');
  const [draftMode, setDraftMode] = useState<'classic' | 'purist'>('classic');

  return (
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <section className="card relative overflow-hidden p-5 sm:p-8">
        <span className="pointer-events-none absolute -left-10 -top-10 h-48 w-48 rounded-full bg-copero-accent/10 blur-3xl" />
        <p className="label-eyebrow">JUGÁ DESDE LA PRIMERA PANTALLA</p>
        <h1 className="heading-display mt-2 text-3xl sm:text-5xl">CREA TU FUTBOLISTA</h1>
        <p className="mt-3 max-w-prose text-sm text-copero-muted sm:text-base">
          Define lo esencial y entra directamente al draft. No necesitás crear una cuenta ni
          atravesar una introducción antes de empezar tu carrera de Copero.
        </p>

        <form
          className="mt-6 grid gap-5 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            window.location.assign('/draft');
          }}
        >
          <div className="space-y-1.5">
            <label className="field-label" htmlFor="surname">APELLIDO</label>
            <input
              id="surname"
              className="input"
              value={surname}
              onChange={(e) => setSurname(e.target.value)}
              placeholder="Tu apellido"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="field-label" htmlFor="number">DORSAL</label>
            <input
              id="number"
              className="input"
              type="number"
              min={1}
              max={99}
              value={number}
              onChange={(e) => setNumber(Number(e.target.value))}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <span className="field-label">PIERNA HÁBIL</span>
            <div className="flex gap-2">
              {(['Izquierda', 'Derecha'] as const).map((opt) => (
                <button
                  type="button"
                  key={opt}
                  onClick={() => setFoot(opt)}
                  className={`flex-1 rounded-copero border px-4 py-3 text-sm font-medium transition ${
                    foot === opt
                      ? 'border-copero-accent bg-copero-accent/10 text-copero-text'
                      : 'border-copero-border bg-copero-surface text-copero-muted hover:text-copero-text'
                  }`}
                  aria-pressed={foot === opt}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="field-label" htmlFor="nationality">NACIONALIDAD</label>
            <select
              id="nationality"
              className="input"
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
            >
              {NATIONALITIES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="field-label" htmlFor="position">POSICIÓN</label>
            <select
              id="position"
              className="input"
              value={position}
              onChange={(e) => setPosition(e.target.value as Position)}
            >
              {POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {POSITION_LABEL[p]}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <div className="flex items-center justify-between rounded-copero border border-dashed border-copero-border px-4 py-3 text-sm">
              <span className="text-copero-muted">Nacionalidad de un familiar</span>
              <span className="text-xs text-copero-muted">
                Padre o madre — puede abrirte otra selección
              </span>
              <span aria-hidden className="text-copero-accent">＋</span>
            </div>
          </div>

          <fieldset className="sm:col-span-2 space-y-2">
            <legend className="field-label">MODO DE DRAFT</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                {
                  id: 'classic',
                  title: 'Classic: más información para construir tu jugador',
                  sub: 'Atributos visibles + 5 cambios',
                },
                {
                  id: 'purist',
                  title: 'Purist: decidí sin ver los valores',
                  sub: 'Valores ocultos + sin cambios',
                },
              ] as const).map((opt) => (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => setDraftMode(opt.id)}
                  className={`rounded-copero border p-4 text-left transition ${
                    draftMode === opt.id
                      ? 'border-copero-accent bg-copero-accent/10'
                      : 'border-copero-border bg-copero-surface hover:border-copero-borderStrong'
                  }`}
                  aria-pressed={draftMode === opt.id}
                >
                  <p className="text-sm font-semibold">{opt.title}</p>
                  <p className="mt-1 text-xs text-copero-muted">{opt.sub}</p>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="sm:col-span-2 flex flex-col items-center gap-3 pt-2">
            <button type="submit" className="btn-primary w-full sm:w-auto">
              Empezar carrera
              <span aria-hidden>→</span>
            </button>
            <p className="text-xs text-copero-muted">
              Gratis · Sin cuenta · Guardado local en este navegador
            </p>
          </div>
        </form>
      </section>

      <aside className="card relative overflow-hidden p-5 sm:p-6">
        <header className="flex items-start justify-between">
          <span className="pill">TU JUGADOR</span>
          <span className="grid h-9 w-9 place-items-center rounded-md bg-copero-accent/15 text-xs font-mono font-semibold text-copero-accent">
            {position}
          </span>
        </header>
        <div className="mt-4 text-center">
          <p className="font-display text-7xl text-copero-text">{number}</p>
          <p className="mt-1 font-display text-xl uppercase tracking-wide">ROOKIE</p>
        </div>
        <hr className="my-5 border-copero-border" />
        <p className="flex items-center gap-2 text-xs text-copero-muted">
          <span aria-hidden>🇦🇷</span> {nationality}
        </p>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide">
          {draftMode === 'classic' ? 'Classic' : 'Purist'}: más información para construir tu jugador
        </p>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="grid aspect-square place-items-center rounded-md border border-copero-border bg-copero-surface text-xs font-mono text-copero-muted"
            >
              {i + 1}
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-copero-muted">
          El siguiente paso es el draft de ocho atributos con leyendas.
        </p>
        <Link
          to="/draft"
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-copero-border px-4 py-2 text-sm font-medium text-copero-text hover:border-copero-borderStrong"
        >
          Ir al draft
          <span aria-hidden>→</span>
        </Link>
      </aside>
    </div>
  );
}