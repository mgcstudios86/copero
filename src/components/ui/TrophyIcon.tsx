/** Icono de trofeo con tooltip visible al hover/focus. */
export function TrophyIcon({
  src,
  name,
  className = 'h-9 w-9',
  count,
}: {
  src: string
  name: string
  className?: string
  count?: number
}) {
  const label = count != null && count > 1 ? `${name} ×${count}` : name
  return (
    <button
      type="button"
      className="group/trophy relative inline-flex cursor-default focus-visible:outline-none"
      title={label}
      aria-label={label}
    >
      <img src={src} alt="" className={`${className} object-contain drop-shadow`} />
      {count != null && count > 1 && (
        <span className="absolute -bottom-1 -right-1 rounded bg-black/80 px-1 text-[9px] font-extrabold text-amber-300">
          ×{count}
        </span>
      )}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-white/15 bg-black/95 px-2 py-1 text-[10px] font-semibold text-white shadow-lg group-hover/trophy:block group-focus-within/trophy:block"
      >
        {label}
      </span>
    </button>
  )
}
