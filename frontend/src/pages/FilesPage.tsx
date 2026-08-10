import { SectionHeader } from '../components/SectionHeader';

export function FilesPage() {
  return (
    <div className="page-stack">
      <SectionHeader
        title="Arquivos"
        description="Catálogo local de PDFs com filtros e pesquisa."
      />
      <div className="content-band">
        <h3>Biblioteca local</h3>
        <p>Nenhum arquivo selecionado para visualização.</p>
      </div>
    </div>
  );
}
