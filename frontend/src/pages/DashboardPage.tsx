import { useEffect } from 'react';
import { AlertTriangle, Cloud, FileText, Gauge, HardDrive, Sheet, Timer } from 'lucide-react';
import { MetricCard } from '../components/MetricCard';
import { SectionHeader } from '../components/SectionHeader';
import { callBackend } from '../services/backend';
import type { DashboardMetrics } from '../types/backend';
import { useAsyncAction } from '../hooks/useAsyncAction';

export function DashboardPage() {
  const metrics = useAsyncAction(() => callBackend<DashboardMetrics>('dashboard.metrics'));

  useEffect(() => {
    metrics.run().catch(() => undefined);
  }, [metrics.run]);

  const data = metrics.data;

  return (
    <div className="page-stack">
      <SectionHeader
        title="Visão geral"
        description="Acompanhe o processamento de notas, Supabase e artefatos gerados."
        actions={
          <button className="button secondary" onClick={() => metrics.run()} type="button">
            Atualizar
          </button>
        }
      />

      {metrics.error ? <div className="alert danger">{metrics.error}</div> : null}

      <div className="metric-grid">
        <MetricCard icon={FileText} label="PDFs locais" value={data?.pdf_count ?? 0} />
        <MetricCard icon={Gauge} label="Processadas" value={data?.processed_count ?? 0} tone="success" />
        <MetricCard icon={AlertTriangle} label="Erros" value={data?.error_count ?? 0} tone="danger" />
        <MetricCard icon={Sheet} label="Planilhas" value={data?.spreadsheet_count ?? 0} />
        <MetricCard icon={Cloud} label="Supabase" value={data?.supabase_status ?? 'carregando'} />
        <MetricCard icon={Timer} label="Tempo médio" value={data?.average_time_seconds ?? '-'} />
        <MetricCard icon={HardDrive} label="Espaço usado" value={formatBytes(data?.used_space_bytes ?? 0)} />
      </div>

      <div className="content-band">
        <h3>Última atividade</h3>
        <div className="activity-line">
          <span>Último processamento</span>
          <strong>{data?.last_processing ?? 'Sem histórico'}</strong>
        </div>
        <div className="activity-line">
          <span>Última sincronização</span>
          <strong>{data?.last_sync ?? 'Sem sincronização'}</strong>
        </div>
      </div>
    </div>
  );
}

function formatBytes(value: number) {
  if (value === 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.floor(Math.log(value) / Math.log(1024));
  const amount = value / 1024 ** index;
  return `${amount.toFixed(1)} ${units[index]}`;
}
