type Status = 'running' | 'stopped' | 'error' | 'unknown' | 'creating'

const STATUS_CONFIG: Record<
  Status,
  { label: string; dotClass: string; textColor: string; bgColor: string }
> = {
  running: {
    label: 'RUNNING',
    dotClass: 'running',
    textColor: 'var(--accent-green)',
    bgColor: 'var(--accent-green-dim)',
  },
  stopped: {
    label: 'STOPPED',
    dotClass: 'stopped',
    textColor: 'var(--text-secondary)',
    bgColor: 'var(--bg-overlay)',
  },
  error: {
    label: 'ERROR',
    dotClass: 'error',
    textColor: 'var(--accent-red)',
    bgColor: 'var(--accent-red-dim)',
  },
  unknown: {
    label: 'UNKNOWN',
    dotClass: 'unknown',
    textColor: 'var(--text-muted)',
    bgColor: 'var(--bg-overlay)',
  },
  creating: {
    label: 'CREATING',
    dotClass: 'unknown',
    textColor: 'var(--accent-amber)',
    bgColor: 'var(--accent-amber-dim)',
  },
}

interface Props {
  status: Status
}

export function StatusBadge({ status }: Props) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.unknown

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5"
      style={{ background: cfg.bgColor, border: `1px solid ${cfg.textColor}22` }}
    >
      <span className={`status-dot ${cfg.dotClass}`} />
      <span
        style={{
          fontSize: '0.625rem',
          fontWeight: 600,
          letterSpacing: '0.1em',
          color: cfg.textColor,
          fontFamily: 'var(--font-mono)',
        }}
      >
        {cfg.label}
      </span>
    </span>
  )
}
