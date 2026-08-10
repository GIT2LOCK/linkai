export interface CommandResult<T> {
  ok: boolean;
  data: T | null;
  error: string | null;
}

export interface OperatorProfile {
  name: string;
  role: string;
  email: string | null;
  avatar_url: string | null;
  source: 'supabase' | 'fallback';
}

export interface UploadedPdfsResponse {
  paths: string[];
  count: number;
}

export type ProcessingSource = 'supabase' | 'folder' | 'files';
export type ExcelMode = 'single_sheet' | 'multi_sheet' | 'one_file_per_pdf';

export interface ProcessingOptions {
  source: ProcessingSource;
  paths: string[];
  generateExcel: boolean;
  downloadPdfsLocally: boolean;
  ignoreDuplicates: boolean;
  useCache: boolean;
  detectXml: boolean;
  useAiWhenNeeded: boolean;
  processSubfolders: boolean;
  excelMode: ExcelMode;
}

export interface ProcessingRow {
  name: string | null;
  type: string;
  pageCount: number | null;
  sizeBytes: number | null;
  status: string;
  source: string;
  hash: string | null;
  documentType: string | null;
  parser: string | null;
  error: string | null;
  progress: number;
}

export interface ProcessingResponse {
  source: string;
  rows?: ProcessingRow[];
  summary: {
    listed: number;
    processed: number;
    ignored: number;
    failed: number;
    duplicated: number;
    elapsedSeconds?: number;
  };
}

export interface SpreadsheetInfo {
  name: string;
  path: string;
  sizeBytes: number;
  modifiedAt: number;
}
