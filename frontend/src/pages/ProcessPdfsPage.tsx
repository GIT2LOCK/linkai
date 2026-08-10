import { Download, FolderOpen, ListChecks, MousePointer, UploadCloud, X } from 'lucide-react';
import type { ChangeEvent, DragEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { useEffect, useRef, useState } from 'react';
import { DataTable } from '../components/DataTable';
import { SectionHeader } from '../components/SectionHeader';
import { ToggleRow } from '../components/ToggleRow';
import { callBackend, isTauriRuntime, uploadLocalPdfs } from '../services/backend';
import type {
  ExcelMode,
  ProcessingOptions,
  ProcessingResponse,
  ProcessingSource
} from '../types/backend';
import { useAsyncAction } from '../hooks/useAsyncAction';

interface BrowserDirectoryHandle {
  name: string;
  getFileHandle: (
    name: string,
    options: { create: boolean }
  ) => Promise<BrowserFileHandle>;
}

interface BrowserFileHandle {
  createWritable: () => Promise<BrowserWritableFileStream>;
}

interface BrowserWritableFileStream {
  write: (data: Blob) => Promise<void>;
  close: () => Promise<void>;
}

declare global {
  interface Window {
    showDirectoryPicker?: () => Promise<BrowserDirectoryHandle>;
  }
}

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
    key: 'downloadedPath',
    label: 'Arquivo local',
    render: (row: Record<string, unknown>) =>
      displayPath(String(row.downloadedPath ?? row.path ?? '-'))
  },
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

const folderInputAttributes = {
  directory: '',
  webkitdirectory: ''
} as Record<string, string>;

export function ProcessPdfsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<ProcessingSource>('supabase');
  const [downloadPath, setDownloadPath] = useState<string | null>(null);
  const [downloadPathLabel, setDownloadPathLabel] = useState<string | null>(null);
  const [browserDownloadDirectory, setBrowserDownloadDirectory] =
    useState<BrowserDirectoryHandle | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [selectedBrowserFiles, setSelectedBrowserFiles] = useState<File[]>([]);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [persistedResponse, setPersistedResponse] = useState<ProcessingResponse | null>(null);
  const [options, setOptions] = useState<
    Omit<ProcessingOptions, 'source' | 'paths' | 'downloadPath' | 'downloadPathLabel'>
  >({
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
  const lastProcessingAction = useAsyncAction(() =>
    callBackend<ProcessingResponse | null>('documents.last')
  );

  useEffect(() => {
    let active = true;

    lastProcessingAction
      .run()
      .then((lastProcessing) => {
        if (!active || !lastProcessing) {
          return;
        }

        setPersistedResponse(lastProcessing);

        if (
          lastProcessing.downloadPath &&
          !lastProcessing.downloadPath.startsWith('Pasta escolhida no navegador:')
        ) {
          setDownloadPath(lastProcessing.downloadPath);
          setDownloadPathLabel(lastProcessing.downloadPath);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  const rows = action.data?.rows ?? persistedResponse?.rows ?? [];
  const selectedDownloadLabel = downloadPathLabel ?? downloadPath;

  async function runProcessing() {
    if (options.downloadPdfsLocally && !selectedDownloadLabel) {
      setSelectionError('Escolha o local padrão de download antes de processar.');
      return;
    }

    if (source !== 'supabase' && selectedPaths.length === 0) {
      setSelectionError('Selecione uma pasta ou pelo menos um PDF antes de processar.');
      return;
    }

    setSelectionError(null);

    if (options.downloadPdfsLocally && browserDownloadDirectory && selectedBrowserFiles.length > 0) {
      try {
        await copyBrowserFilesToDirectory(selectedBrowserFiles, browserDownloadDirectory);
      } catch {
        setSelectionError('Não foi possível salvar os PDFs na pasta escolhida pelo navegador.');
        return;
      }
    }

    try {
      const result = await action.run({
        ...options,
        source,
        paths: selectedPaths,
        downloadPath,
        downloadPathLabel: selectedDownloadLabel
      });
      setPersistedResponse(result);
    } catch {
      return;
    }
  }

  function setExcelMode(excelMode: ExcelMode) {
    setOptions((current) => ({ ...current, excelMode }));
  }

  function selectSupabase() {
    setSource('supabase');
    setSelectionError(null);
  }

  async function selectDownloadPath() {
    setSelectionError(null);

    if (!isTauriRuntime()) {
      if (!window.showDirectoryPicker) {
        setSelectionError(
          'Este navegador não permite escolher pasta de destino. Abra pelo app Tauri ou use Chrome/Edge atualizado.'
        );
        return;
      }

      try {
        const directory = await window.showDirectoryPicker();
        setBrowserDownloadDirectory(directory);
        setDownloadPath(null);
        setDownloadPathLabel(`Pasta escolhida no navegador: ${directory.name}`);
      } catch (error) {
        setSelectionError(selectionDialogError(error));
      }

      return;
    }

    try {
      const selected = await open({
        directory: true,
        multiple: false
      });

      if (typeof selected === 'string') {
        setBrowserDownloadDirectory(null);
        setDownloadPath(selected);
        setDownloadPathLabel(selected);
      }
    } catch (error) {
      setSelectionError(selectionDialogError(error));
    }
  }

  async function selectFolder() {
    setSelectionError(null);

    if (!isTauriRuntime()) {
      folderInputRef.current?.click();
      return;
    }

    try {
      const selected = await open({
        directory: true,
        multiple: false
      });

      if (typeof selected === 'string') {
        setSelectedBrowserFiles([]);
        setSelectedPaths([selected]);
        setSource('folder');
      }
    } catch (error) {
      setSelectionError(selectionDialogError(error));
    }
  }

  async function selectFiles() {
    setSelectionError(null);

    if (!isTauriRuntime()) {
      fileInputRef.current?.click();
      return;
    }

    try {
      const selected = await open({
        directory: false,
        multiple: true,
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      });

      if (Array.isArray(selected)) {
        setSelectedBrowserFiles([]);
        setSelectedPaths(selected);
        setSource('files');
      } else if (typeof selected === 'string') {
        setSelectedBrowserFiles([]);
        setSelectedPaths([selected]);
        setSource('files');
      }
    } catch (error) {
      setSelectionError(selectionDialogError(error));
    }
  }

  async function handleBrowserFileSelection(event: ChangeEvent<HTMLInputElement>) {
    await uploadBrowserSelection(Array.from(event.target.files ?? []), 'files');
    event.target.value = '';
  }

  async function handleBrowserFolderSelection(event: ChangeEvent<HTMLInputElement>) {
    await uploadBrowserSelection(Array.from(event.target.files ?? []), 'folder');
    event.target.value = '';
  }

  async function uploadBrowserSelection(files: File[], nextSource: ProcessingSource) {
    const pdfFiles = files.filter((file) => file.name.toLowerCase().endsWith('.pdf'));

    if (pdfFiles.length === 0) {
      setSelectionError('Nenhum PDF foi encontrado na seleção.');
      return;
    }

    try {
      const uploaded = await uploadLocalPdfs(pdfFiles);

      if (uploaded.paths.length === 0) {
        setSelectionError('Nenhum PDF válido foi enviado para processamento.');
        return;
      }

      setSelectedBrowserFiles(pdfFiles);
      setSelectedPaths(uploaded.paths);
      setSource(nextSource);
      setSelectionError(null);
    } catch (error) {
      setSelectionError(uploadErrorMessage(error));
    }
  }

  function clearSelection() {
    setSelectedBrowserFiles([]);
    setSelectedPaths([]);
    setSelectionError(null);
  }

  async function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    const files = Array.from(event.dataTransfer.files);
    const paths = files
      .map((file) => (file as File & { path?: string }).path)
      .filter((path): path is string => Boolean(path));

    if (paths.length > 0) {
      setSelectedBrowserFiles([]);
      setSelectedPaths(paths);
      setSource('files');
      setSelectionError(null);
      return;
    }

    await uploadBrowserSelection(files, 'files');
  }

  return (
    <div className="page-stack">
      <input
        accept="application/pdf,.pdf"
        className="hidden-file-input"
        multiple
        onChange={handleBrowserFileSelection}
        ref={fileInputRef}
        type="file"
      />
      <input
        {...folderInputAttributes}
        className="hidden-file-input"
        multiple
        onChange={handleBrowserFolderSelection}
        ref={folderInputRef}
        type="file"
      />

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

      <div className="download-location-panel">
        <div>
          <strong>Local padrão de download</strong>
          <span>{selectedDownloadLabel ?? 'Escolha uma pasta antes de processar.'}</span>
        </div>
        <button className="button secondary" onClick={selectDownloadPath} type="button">
          <Download size={16} />
          Escolher pasta
        </button>
      </div>

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
        emptyLabel="Nenhum PDF processado ainda."
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

async function copyBrowserFilesToDirectory(
  files: File[],
  directory: BrowserDirectoryHandle
) {
  for (const file of files) {
    const fileHandle = await directory.getFileHandle(file.name, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(file);
    await writable.close();
  }
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

  return 'Não foi possível abrir o seletor nativo do aplicativo.';
}

function uploadErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('404')) {
    return 'A API local está rodando, mas está desatualizada. Rode stop-linkai-web.ps1 e depois run-linkai-web.ps1.';
  }

  if (message.includes('Failed to fetch') || message.includes('unavailable')) {
    return 'Não foi possível enviar os PDFs para a API local. Verifique se o backend está rodando na porta 8765.';
  }

  return 'Não foi possível enviar os PDFs para a API local.';
}
