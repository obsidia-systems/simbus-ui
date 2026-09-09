import { useQuery } from '@tanstack/react-query'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'

import { apiGet } from '@/app/api'

export function Shell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const meta = useQuery({
    queryKey: ['meta'],
    queryFn: () => apiGet<{ image: string; mode: string }>('/api/meta'),
    staleTime: Infinity,
  })

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg-base)]/90 backdrop-blur-sm">
        <nav className="mx-auto flex h-12 max-w-7xl items-center gap-6 px-4">
          <Link to="/" className="group flex shrink-0 items-center gap-2">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="shrink-0">
              <rect
                x="1"
                y="5"
                width="20"
                height="3"
                rx="1.5"
                fill="var(--accent-cyan)"
                opacity="0.9"
              />
              <rect
                x="1"
                y="11"
                width="14"
                height="3"
                rx="1.5"
                fill="var(--accent-green)"
                opacity="0.9"
              />
              <rect
                x="1"
                y="17"
                width="8"
                height="3"
                rx="1.5"
                fill="var(--accent-cyan)"
                opacity="0.4"
              />
            </svg>
            <span
              className="text-sm font-semibold tracking-widest text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent-cyan)]"
              style={{ letterSpacing: '0.18em' }}
            >
              SIMBUS
            </span>
          </Link>
          <div className="flex flex-1 items-center gap-1">
            <Link to="/" className={`nav-link ${pathname === '/' ? 'active' : ''}`}>
              Devices
            </Link>
            <Link
              to="/presets"
              className={`nav-link ${pathname.startsWith('/presets') ? 'active' : ''}`}
            >
              Presets
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <span className="field-label">image</span>
            <span className="mono-value text-[0.7rem]">
              {meta.data?.image ?? 'simbus:0.3.0'}
            </span>
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <footer className="border-t border-[var(--border-subtle)] px-4 py-3">
        <p className="text-center text-[0.6875rem] text-[var(--text-muted)]">
          simbus-ui · site of field slaves · control plane never published
        </p>
      </footer>
    </div>
  )
}
