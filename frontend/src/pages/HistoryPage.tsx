import { SectionHeader } from '../components/SectionHeader';

export function HistoryPage() {
  return (
    <div className="page-stack">
      <SectionHeader
        title="Histórico"
        description="Processamentos, origem, duração, erros e planilhas geradas."
      />
      <div className="content-band">
        <h3>Registro de execução</h3>
        <p>Sem execuções registradas para exibição.</p>
      </div>
    </div>
  );
}
