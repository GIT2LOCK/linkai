import type { ReactNode } from 'react';
import linkaiIconUrl from '../assets/linkai-icon.png';
import linkaiLogoUrl from '../assets/linkai-logo.png';
import type { NavigationItem, PageKey } from '../types/navigation';

interface AppShellProps {
  activePage: PageKey;
  children: ReactNode;
  navigation: NavigationItem[];
  onNavigate: (page: PageKey) => void;
}

export function AppShell({
  activePage,
  children,
  navigation,
  onNavigate
}: AppShellProps) {
  const activeLabel = navigation.find((item) => item.key === activePage)?.label ?? 'Dashboard';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-card">
          <img className="brand-logo" src={linkaiLogoUrl} alt="LinkAI Engenharia" />
        </div>

        <div className="nav-section-title">Navegação</div>

        <nav className="nav-list" aria-label="Navegação principal">
          {navigation.map((item) => {
            const Icon = item.icon;
            const selected = item.key === activePage;

            return (
              <button
                aria-current={selected ? 'page' : undefined}
                className={`nav-item ${selected ? 'is-active' : ''}`}
                key={item.key}
                onClick={() => onNavigate(item.key)}
                type="button"
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <img src={linkaiIconUrl} alt="" />
          <div>
            <span>LinkAI Desktop</span>
            <strong>Automação Lumina e inteligência fiscal corporativa.</strong>
          </div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <span className="eyebrow">Workspace</span>
            <h1>{activeLabel}</h1>
          </div>
          <div className="status-pill">
            <span className="pulse" />
            Serviços ativos
          </div>
        </header>
        <section className="page-surface">{children}</section>
      </main>
    </div>
  );
}
