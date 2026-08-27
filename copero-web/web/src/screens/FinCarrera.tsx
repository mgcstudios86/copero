import { Link } from 'react-router-dom';
import {
  FINAL_ATTRIBUTES,
  FINAL_SKILLS,
  OVR_INICIAL,
  POTENCIAL,
} from '../data/mock';

export default function FinCarrera() {
  return (
    <div className="space-y-6">
      <header className="space-y-2 text-center">
        <span className="pill pill-amber mx-auto">CARRERA COMPLETA</span>
        <h1 className="heading-display mt-2 text-4xl sm:text-5xl">FIN DE CARRERA</h1>
        <p className="mx-auto max-w-prose text-sm text-copero-muted">
          Cierre de la carrera. Resumen de tus mejores temporadas, vitrina y legado.
        </p>
      </header>

      <section className="card p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-copero border border-copero-border bg-copero-surface p-4">
            <p className="field-label">EDAD DE RETIRO</p>
            <p className="mt-1 font-display text-2xl">34</p>
          </div>
          <div className="rounded-copero border border-copero-border bg-copero-surface p-4">
            <p className="field-label">OVR FINAL</p>
            <p className="mt-1 font-display text-2xl text-copero-accent">
              {POTENCIAL - 3}
            </p>
          </div>
          <div className="rounded-copero border border-copero-border bg-copero-surface p-4">
            <p className="field-label">PARTIDOS</p>
            <p className="mt-1 font-display text-2xl">487</p>
          </div>
          <div className="rounded-copero border border-copero-border bg-copero-surface p-4">
            <p className="field-label">GOLES + ASIST.</p>
            <p className="mt-1 font-display text-2xl">212</p>
          </div>
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <p className="label-eyebrow">ATRIBUTOS AL RETIRO</p>
        <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-8">
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
      </section>

      <section className="card p-5 sm:p-6">
        <p className="label-eyebrow">VITRINA</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {['Copa Argentina', 'Supercopa', 'Selección 23 caps', 'Bota de oro'].map((t) => (
            <div
              key={t}
              className="rounded-copero border border-copero-border bg-copero-surface p-4 text-center"
            >
              <p aria-hidden className="text-2xl">🏆</p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide">{t}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <p className="label-eyebrow">LEGADO</p>
        <p className="mt-2 font-display text-2xl uppercase">OVR {OVR_INICIAL} → {POTENCIAL - 3}</p>
        <p className="mt-2 text-sm text-copero-muted">
          Cresciste de rookie a referente. Tu historia queda guardada en este navegador.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to="/identidad" className="btn-primary">
            Empezar nueva carrera
          </Link>
          <Link to="/temporada" className="btn-secondary">
            Volver al dashboard
          </Link>
        </div>
      </section>
    </div>
  );
}