import { FolderOpen, ListChecks, MousePointer, UploadCloud, X } from 'lucide-react';
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
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [selectionError, setSelectionError] = useState<string | null>(null);
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
    if (source !== 'supabase' && selectedPaths.length === 0) {
      setSelectionError('Selecione uma pasta ou pelo menos um PDF antes de processar.');
      return;
    }

    setSelectionError(null);

    action
      .run({
        ...options,
        source,
        paths: selectedPaths
      })
      .catch(() => undefined);
  }

  function setExcelMode(excelMode: ExcelMode) {
    setOptions((current) => ({ ...current, excelMode }));
  }

  function selectSupabase() {
    setSource('supabase');
    setSelectionError(null);
  }

  async function selectFolder() {
    setSelectionError(null);

    try {
      const selected = await open({
        directory: true,
        multiple: false
      });

      if (typeof selected === 'string') {
        setSelectedPaths([selected]);
        setSource('folder');
      }
    } catch (error) {
      setSelectionError(selectionDialogError(error));
    }
  }

  async function selectFiles() {
    setSelectionError(null);

    try {
      const selected = await open({
        directory: false,
        multiple: true,
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      });

      if (Array.isArray(selected)) {
        setSelectedPaths(selected);
        setSource('files');
      } else if (typeof selected === 'string') {
        setSelectedPaths([selected]);
        setSource('files');
      }
    } catch (error) {
      setSelectionError(selectionDialogError(error));
    }
  }

  function clearSelection() {
    setSelectedPaths([]);
    setSelectionError(null);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const paths = Array.from(event.dataTransfer.files)
      .map((file) => (file as File & { path?: string }).path ?? file.name)
      .filter(Boolean);

    if (paths.length > 0) {
      setSelectedPaths(paths);
      setSource('files');
      setSelectionError(null);
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
      {selectionError ? <div className="alert danger">{selectionError}</div> : null}

      <div className="source-grid">
        <SourceOption
          active={source === 'supabase'}
          icon={UploadCloud}
          label="Bucket Supabase"
          onClick={selectSupabase}
        />
        <SourceOption
          active={source === 'folder'}
          icon={FolderOpen}
          label="Pasta inteira"
          onClick={selectFolder}
        />
        <SourceOption
          active={source === 'files'}
          icon={MousePointer}
          label="Arquivos manuais"
          onClick={selectFiles}
        />
      </div>

      <div
        className="drop-zone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <div>
          <strong>{selectionTitle(source, selectedPaths.length)}</strong>
          <span>{selectionDescription(source, selectedPaths)}</span>
        </div>
        <div className="drop-actions">
          <button className="button secondary" onClick={selectFolder} type="button">
            Selecionar pasta
          </button>
          <button className="button secondary" onClick={selectFiles} type="button">
            Selecionar PDFs
          </button>
          {selectedPaths.length > 0 ? (
            <button className="button ghost" onClick={clearSelection} type="button">
              <X size={16} />
              Limpar
            </button>
          ) : null}
        </div>
      </div>

      {selectedPaths.length > 0 ? (
        <div className="selected-files-panel">
          <div>
            <span>Selecionado</span>
            <strong>{selectedPaths.length === 1 ? '1 item' : `${selectedPaths.length} itens`}</strong>
          </div>
          <ul>
            {selectedPaths.slice(0, 6).map((path) => (
              <li key={path}>{displayPath(path)}</li>
            ))}
          </ul>
          {selectedPaths.length > 6 ? (
            <small>+{selectedPaths.length - 6} arquivo(s) oculto(s)</small>
          ) : null}
        </div>
      ) : null}

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
  onClick: () => void | Promise<void>;
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

function displayPath(path: string) {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

function selectionTitle(source: ProcessingSource, count: number) {
  if (source === 'supabase') {
    return 'Entrada pelo Supabase';
  }

  if (count > 0) {
    return source === 'folder' ? 'Pasta selecionada' : 'PDFs selecionados';
  }

  return source === 'folder' ? 'Selecione uma pasta' : 'Selecione PDFs';
}

function selectionDescription(source: ProcessingSource, paths: string[]) {
  if (source === 'supabase') {
    return 'Os PDFs serão buscados automaticamente no bucket privado configurado.';
  }

  if (paths.length === 0) {
    return 'Use o botão de seleção para abrir o explorador do computador.';
  }

  if (source === 'folder') {
    return displayPath(paths[0]);
  }

  return paths.length === 1 ? displayPath(paths[0]) : `${paths.length} PDFs selecionados.`;
}

function selectionDialogError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.toLowerCase().includes('cancel')) {
    return null;
  }

  return 'Não foi possível abrir o seletor de arquivos neste ambiente.';
}
