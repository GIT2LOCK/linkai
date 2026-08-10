import { useMemo, useState } from 'react';
import {
  BarChart3,
  Bot,
  Cloud,
  FileArchive,
  FileSpreadsheet,
  Files,
  Home,
  Play,
  ScrollText,
  Settings
} from 'lucide-react';
import { AppShell } from './layouts/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { ProcessPdfsPage } from './pages/ProcessPdfsPage';
import { LaunchNotesPage } from './pages/LaunchNotesPage';
import { SpreadsheetsPage } from './pages/SpreadsheetsPage';
import { SupabasePage } from './pages/SupabasePage';
import { FilesPage } from './pages/FilesPage';
import { AiPage } from './pages/AiPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { LogsPage } from './pages/LogsPage';
import type { NavigationItem, PageKey } from './types/navigation';

const navigation: NavigationItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: Home },
  { key: 'processar-pdfs', label: 'Processar PDFs', icon: FileArchive },
  { key: 'lancar-notas', label: 'Lançar Notas', icon: Play },
  { key: 'planilhas', label: 'Planilhas', icon: FileSpreadsheet },
  { key: 'supabase', label: 'Supabase', icon: Cloud },
  { key: 'arquivos', label: 'Arquivos', icon: Files },
  { key: 'ia', label: 'Inteligência Artificial', icon: Bot },
  { key: 'historico', label: 'Histórico', icon: ScrollText },
  { key: 'configuracoes', label: 'Configurações', icon: Settings },
  { key: 'logs', label: 'Logs', icon: BarChart3 }
];

export function App() {
  const [activePage, setActivePage] = useState<PageKey>('dashboard');

  const page = useMemo(() => {
    switch (activePage) {
      case 'processar-pdfs':
        return <ProcessPdfsPage />;
      case 'lancar-notas':
        return <LaunchNotesPage />;
      case 'planilhas':
        return <SpreadsheetsPage />;
      case 'supabase':
        return <SupabasePage />;
      case 'arquivos':
        return <FilesPage />;
      case 'ia':
        return <AiPage />;
      case 'historico':
        return <HistoryPage />;
      case 'configuracoes':
        return <SettingsPage />;
      case 'logs':
        return <LogsPage />;
      default:
        return <DashboardPage />;
    }
  }, [activePage]);

  return (
    <AppShell
      activePage={activePage}
      navigation={navigation}
      onNavigate={setActivePage}
    >
      {page}
    </AppShell>
  );
}
