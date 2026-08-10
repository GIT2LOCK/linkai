import { FolderOpen, ListChecks, MousePointer, UploadCloud } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { useState } from 'react';
import { DataTable } from '../components/DataTable';
import { SectionHeader } from '../components/SectionHeader';
import { ToggleRow } from '../components/ToggleRow';
import { callBackend } from '../services/backend';
import type {
  ExcelMode,
  ProcessingOptions,
  ProcessingResponse,
  ProcessingSource
} from '../types/backend';
import { useAsyncAction } from '../hooks/useAsyncAction';

const columns = [
  { key: 'name', label: 'Nome' },
  { key: 'documentType', label: 'Documento' },
  { key: 'pageCount', label: 'Páginas' },
  {
    key: 'sizeBytes',
    label: 'Tamanho',
    render: (row: Record<string, unknown>) => formatBytes(row.sizeBytes as number | null)
  },
  { key: 'status', label: 'Status' },
  { key: 'source', label: 'Origem' },
  {
    key: 'hash',
    label: 'Hash',
    render: (row: Record<string, unknown>) =>
      typeof row.hash === 'string' ? row.hash.slice(0, 12) : '-'
  },
  { key: 'parser', label: 'Parser' },
  {
    key: 'error',
    label: 'Erro',
    render: (row: Record<string, unknown>) => String(row.error ?? '-')
  },
  {
    key: 'progress',
    label: 'Progresso',
    render: (row: Record<string, unknown>) => `${String(row.progress ?? 0)}%`
  }
];

export function ProcessPdfsPage() {
  const [source, setSource] = useState<ProcessingSource>('supabase');
  const [pathsText, setPathsText] = useState('');
  const [options, setOptions] = useState<Omit<ProcessingOptions, 'source' | 'paths'>>({
    generateExcel: true,
    downloadPdfsLocally: true,
    ignoreDuplicates: true,
    useCache: true,
    detectXml: true,
    useAiWhenNeeded: false,
    processSubfolders: true,
    excelMode: 'single_sheet'
  });
  const action = useAsyncAction((payload: ProcessingOptions) =>
    callBackend<ProcessingResponse>('documents.process', payload)
  );

  const rows = action.data?.rows ?? [];

  function runProcessing() {
    const paths = pathsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    action
      .run({
        ...options,
        source,
        paths
      })
      .catch(() => undefined);
  }

  function setExcelMode(excelMode: ExcelMode) {
    setOptions((current) => ({ ...current, excelMode }));
  }

  async function selectFolder() {
    const selected = await open({
      directory: true,
      multiple: false
    });

    if (typeof selected === 'string') {
      setPathsText(selected);
      setSource('folder');
    }
  }

  async function selectFiles() {
    const selected = await open({
      directory: false,
      multiple: true,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });

    if (Array.isArray(selected)) {
      setPathsText(selected.join('\n'));
      setSource('files');
    } else if (typeof selected === 'string') {
      setPathsText(selected);
      setSource('files');
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const paths = Array.from(event.dataTransfer.files)
      .map((file) => (file as File & { path?: string }).path ?? file.name)
      .filter(Boolean);

    if (paths.length > 0) {
      setPathsText(paths.join('\n'));
      setSource('files');
    }
  }

  return (
    <div className="page-stack">
      <SectionHeader
        title="Processar PDFs"
        description="Importe documentos, acompanhe a detecção e gere planilhas."
        actions={
          <button className="button primary" disabled={action.loading} onClick={runProcessing} type="button">
            {action.loading ? 'Processando' : 'Processar'}
          </button>
        }
      />

      {action.error ? <div className="alert danger">{action.error}</div> : null}

      <div className="source-grid">
        <SourceOption
          active={source === 'supabase'}
          icon={UploadCloud}
          label="Bucket Supabase"
          onClick={() => setSource('supabase')}
        />
        <SourceOption
          active={source === 'folder'}
          icon={FolderOpen}
          label="Pasta inteira"
          onClick={() => setSource('folder')}
        />
        <SourceOption
          active={source === 'files'}
          icon={MousePointer}
          label="Arquivos manuais"
          onClick={() => setSource('files')}
        />
      </div>

      {source !== 'supabase' ? (
        <label className="field">
          <span>Caminhos locais, um por linha</span>
          <textarea
            onChange={(event) => setPathsText(event.target.value)}
            placeholder={'C:\\notas\\entrada\nC:\\notas\\manual\\nota.pdf'}
            value={pathsText}
          />
        </label>
      ) : null}

      <div
        className="drop-zone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <div>
          <strong>Entrada manual</strong>
          <span>Selecione uma pasta, múltiplos PDFs ou arraste documentos para cá.</span>
        </div>
        <div className="drop-actions">
          <button className="button secondary" onClick={selectFolder} type="button">
            Selecionar pasta
          </button>
          <button className="button secondary" onClick={selectFiles} type="button">
            Selecionar PDFs
          </button>
        </div>
      </div>

      <div className="split-grid">
        <div className="content-band">
          <h3>Opções</h3>
          <ToggleRow
            checked={options.generateExcel}
            label="Gerar Excel"
            onChange={(checked) => setOptions((current) => ({ ...current, generateExcel: checked }))}
          />
          <ToggleRow
            checked={options.downloadPdfsLocally}
            label="Baixar PDFs localmente"
            onChange={(checked) =>
              setOptions((current) => ({ ...current, downloadPdfsLocally: checked }))
            }
          />
          <ToggleRow
            checked={options.ignoreDuplicates}
            label="Ignorar PDFs duplicados"
            onChange={(checked) => setOptions((current) => ({ ...current, ignoreDuplicates: checked }))}
          />
          <ToggleRow
            checked={options.useCache}
            label="Utilizar cache"
            onChange={(checked) => setOptions((current) => ({ ...current, useCache: checked }))}
          />
          <ToggleRow
            checked={options.detectXml}
            label="Detectar XML automaticamente"
            onChange={(checked) => setOptions((current) => ({ ...current, detectXml: checked }))}
          />
          <ToggleRow
            checked={options.useAiWhenNeeded}
            label="Utilizar IA quando necessário"
            onChange={(checked) => setOptions((current) => ({ ...current, useAiWhenNeeded: checked }))}
          />
          <ToggleRow
            checked={options.processSubfolders}
            label="Processar subpastas"
            onChange={(checked) => setOptions((current) => ({ ...current, processSubfolders: checked }))}
          />
        </div>

        <div className="content-band">
          <h3>Excel</h3>
          <button
            className={`segmented ${options.excelMode === 'one_file_per_pdf' ? 'is-active' : ''}`}
            onClick={() => setExcelMode('one_file_per_pdf')}
            type="button"
          >
            Uma planilha por PDF
          </button>
          <button
            className={`segmented ${options.excelMode === 'single_sheet' ? 'is-active' : ''}`}
            onClick={() => setExcelMode('single_sheet')}
            type="button"
          >
            Uma única aba
          </button>
          <button
            className={`segmented ${options.excelMode === 'multi_sheet' ? 'is-active' : ''}`}
            onClick={() => setExcelMode('multi_sheet')}
            type="button"
          >
            Abas separadas
          </button>
          <div className="hint">
            <ListChecks size={16} />
            Cada documento pode virar uma aba dedicada dentro do mesmo Excel.
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        emptyLabel="Nenhum PDF processado nesta sessão."
        rows={rows as unknown as Record<string, unknown>[]}
      />
    </div>
  );
}

interface SourceOptionProps {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}

function SourceOption({ active, icon: Icon, label, onClick }: SourceOptionProps) {
  return (
    <button className={`source-option ${active ? 'is-active' : ''}`} onClick={onClick} type="button">
      <Icon size={20} />
      <span>{label}</span>
    </button>
  );
}

function formatBytes(value: number | null) {
  if (!value) {
    return '-';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.floor(Math.log(value) / Math.log(1024));
  return `${(value / 1024 ** index).toFixed(1)} ${units[index]}`;
}
