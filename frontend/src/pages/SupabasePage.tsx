import { CloudCog } from 'lucide-react';
import { SectionHeader } from '../components/SectionHeader';
import { callBackend } from '../services/backend';
import { useAsyncAction } from '../hooks/useAsyncAction';

export function SupabasePage() {
  const action = useAsyncAction(() =>
    callBackend<{ status: string; bucket: string; folder: string; items: number }>('supabase.test')
  );

  return (
    <div className="page-stack">
      <SectionHeader
        title="Supabase"
        description="Verifique conexão, bucket e pasta configurada."
        actions={
          <button className="button primary" disabled={action.loading} onClick={() => action.run()} type="button">
            Testar conexão
          </button>
        }
      />
      <div className="settings-grid">
        <div className="content-band">
          <CloudCog size={28} />
          <h3>Conexão privada</h3>
          <p>Use credenciais administrativas apenas em ambiente seguro.</p>
        </div>
        <div className="content-band">
          <h3>Status</h3>
          {action.data ? (
            <>
              <div className="activity-line"><span>Status</span><strong>{action.data.status}</strong></div>
              <div className="activity-line"><span>Bucket</span><strong>{action.data.bucket}</strong></div>
              <div className="activity-line"><span>Pasta</span><strong>{action.data.folder || '/'}</strong></div>
              <div className="activity-line"><span>Itens</span><strong>{action.data.items}</strong></div>
            </>
          ) : (
            <p>Use o teste para validar URL, bucket, pasta e credencial.</p>
          )}
          {action.error ? <div className="alert danger">{action.error}</div> : null}
        </div>
      </div>
    </div>
  );
}
