import type { LucideIcon } from 'lucide-react';

export type PageKey =
  | 'processar-pdfs'
  | 'lancar-notas'
  | 'planilhas'
  | 'supabase'
  | 'arquivos'
  | 'ia'
  | 'historico'
  | 'configuracoes'
  | 'logs';

export interface NavigationItem {
  key: PageKey;
  label: string;
  icon: LucideIcon;
}
