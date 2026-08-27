import { Link } from 'react-router-dom';
import {
  FINAL_ATTRIBUTES,
  FINAL_SKILLS,
  OVR_INICIAL,
  PICKS,
  POTENCIAL,
} from '../data/mock';

export default function DraftComplete() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1.6fr]">
      <section className="space-y-5">
        <span className="pill pill-accent">DRAFT COMPLETE</span>
        <h1 className="heading-display text-4xl sm:text-5xl">
          TU FUTURO YA
          <br />
          TIENE FORMA
        </h1>
        <p className="max-w-prose text-sm text-copero-muted">
          El potencial se calcula según la posición y los ocho atributos elegidos. Es el techo
          de crecimiento de tu jugador durante la carrera.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4">
            <p className="field-label">OVR INICIAL</p>
            <p className="mt-1 font-display text-3xl">{OVR_INICIAL}</p>
          </div>
          <div className="card border-copero-accent/30 p-4">
            <p className="field-label">POTENCIAL</p>
            <p className="mt-1 font-display text-3xl text-copero-accent">{POTENCIAL}</p>
          </div>
        </div>

        <Link to="/club" className="btn-primary w-full sm:w-auto">
          Elegir club de origen
          <span aria-hidden>→</span>
        </Link>
      </section>

      <article className="card relative overflow-hidden p-5 sm:p-6">
        <header className="flex items-start justify-between">
          <span className="pill pill-amber">DRAFT COMPLETE</span>
          <div className="text-right">
            <p className="font-display text-2xl uppercase">CALVO</p>
            <p className="text-xs text-copero-muted">#10 · Zurdo</p>
          </div>
        </header>

        <div className="mt-4 flex items-end gap-4">
          <p className="font-display text-6xl text-copero-amber">{POTENCIAL}</p>
          <div>
            <p className="font-display text-xl uppercase">Delantero</p>
            <p className="text-[10px] font-mono uppercase tracking-widest text-copero-muted">
              ARGENTINA
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-3">
          {FINAL_ATTRIBUTES.map((a) => (
            <div key={a.key} className="tile text-center">
              <p className="text-[10px] font-mono uppercase tracking-widest text-copero-muted">
                {a.key}
              </p>
              <p className="mt-1 font-display text-2xl">{a.value}</p>
            </div>
          ))}
          {FINAL_SKILLS.map((s) => (
            <div key={s.key} className="tile text-center">
              <p className="text-[10px] font-mono uppercase tracking-widest text-copero-muted">
                {s.key}
              </p>
              <p className="mt-1 font-display text-2xl text-copero-amber">
                {s.value}★
              </p>
            </div>
          ))}
        </div>

        <hr className="my-5 border-copero-border" />
        <p className="label-eyebrow">CONSTRUIDO CON</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {PICKS.map((p) => (
            <span
              key={p.attr + p.legendName}
              className="rounded-full border border-copero-border bg-copero-surface px-3 py-1 text-xs font-mono uppercase tracking-wide text-copero-text"
            >
              {p.attr} · {p.legendName}
            </span>
          ))}
        </div>
      </article>
    </div>
  );
}