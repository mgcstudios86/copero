import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ')
}

export function Surface({
  children,
  className,
  tone = 'default',
  interactive = false,
  ...props
}: HTMLAttributes<HTMLElement> & {
  children: ReactNode
  tone?: 'default' | 'strong' | 'gold' | 'accent' | 'danger'
  interactive?: boolean
}) {
  return (
    <section
      className={cx('game-surface', `game-surface--${tone}`, interactive && 'game-surface--interactive', className)}
      {...props}
    >
      {children}
    </section>
  )
}

export function GameButton({
  children,
  className,
  variant = 'primary',
  size = 'md',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold'
  size?: 'sm' | 'md' | 'lg'
}) {
  return (
    <button
      className={cx('game-button', `game-button--${variant}`, `game-button--${size}`, className)}
      {...props}
    >
      {children}
    </button>
  )
}

export function GameBadge({
  children,
  className,
  tone = 'neutral',
  mono = false,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode
  tone?: 'neutral' | 'accent' | 'gold' | 'success' | 'danger' | 'info'
  mono?: boolean
}) {
  return (
    <span className={cx('game-badge', `game-badge--${tone}`, mono && 'game-badge--mono', className)} {...props}>
      {children}
    </span>
  )
}

export function SectionEyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx('game-eyebrow', className)}>{children}</p>
}

export function SectionTitle({
  children,
  className,
  as = 'h2',
}: {
  children: ReactNode
  className?: string
  as?: 'h1' | 'h2' | 'h3'
}) {
  const Tag = as
  return <Tag className={cx('game-title', `game-title--${as}`, className)}>{children}</Tag>
}

export function Metric({
  label,
  value,
  className,
  tone = 'default',
}: {
  label: ReactNode
  value: ReactNode
  className?: string
  tone?: 'default' | 'accent' | 'gold'
}) {
  return (
    <div className={cx('game-metric', `game-metric--${tone}`, className)}>
      <div className="game-metric__label">{label}</div>
      <div className="game-metric__value">{value}</div>
    </div>
  )
}

export function StatusPanel({
  children,
  className,
  tone = 'neutral',
}: {
  children: ReactNode
  className?: string
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger'
}) {
  return <div className={cx('game-status', `game-status--${tone}`, className)}>{children}</div>
}

export function EmptyState({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('game-empty', className)}>{children}</div>
}

export function IconTile({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('game-icon-tile', className)}>{children}</span>
}
