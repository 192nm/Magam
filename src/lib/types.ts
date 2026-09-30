export type NameMode = 'customer' | 'stylist' | 'both';
export type Tab = 'today' | 'history' | 'settings';
export interface Entry {
  id: string;
  name: string;
  service: string;
  amount: number | null;
  needsReview: boolean;
  source: string;
}
export interface Settings {
  salonName: string;
  nameMode: NameMode;
  includeService: boolean;
  compact: boolean;
}
export interface Draft {
  date: string;
  entries: Entry[];
}
export interface SavedReport {
  id: string;
  date: string;
  text: string;
  total: number;
  count: number;
  createdAt: string;
  sample: boolean;
}
export interface Store {
  version: 1;
  draft: Draft;
  settings: Settings;
  history: SavedReport[];
}
export interface Health {
  status: string;
  recognitionAvailable: boolean;
  accessKeyRequired: boolean;
}
export interface Extraction {
  entries: Omit<Entry, 'id' | 'source'>[];
  warnings: string[];
}
export interface Report {
  text: string;
  total: number;
  count: number;
}
