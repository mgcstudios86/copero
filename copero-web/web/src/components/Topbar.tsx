import { Link, NavLink } from 'react-router-dom';

const NAV = [
  { to: '/identidad', label: 'Identidad' },
  { to: '/draft', label: 'Draft' },
  { to: '/club', label: 'Club' },
  { to: '/temporada', label: 'Temporada' },
  { to: '/fin', label: 'Fin' },
];

export default function Topbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-copero-border bg-copero-bg/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/identidad" className="flex items-center gap-2 text-copero-text">
          <span
            aria-hidden
            className="grid h-8 w-8 place-items-center rounded-md bg-copero-accent font-display text-copero-bg"
          >
            C
          </span>
          <span className="font-display text-lg tracking-wide">COPERO</span>
        </Link>
        <nav aria-label="Secciones" className="hidden gap-1 sm:flex">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  isActive
                    ? 'bg-copero-accent/15 text-copero-accent'
                    : 'text-copero-muted hover:text-copero-text'
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/identidad"
            className="hidden rounded-full border border-copero-border px-3 py-1.5 text-xs font-medium text-copero-text hover:border-copero-borderStrong sm:inline-block"
          >
            Inicio
          </Link>
          <button
            type="button"
            className="flex items-center gap-1 rounded-full border border-copero-border px-3 py-1.5 text-xs font-medium text-copero-text hover:border-copero-borderStrong"
            aria-label="Cambiar idioma"
          >
            ES <span aria-hidden>▾</span>
          </button>
        </div>
      </div>
    </header>
  );
}