import type { Draft, Entry, Settings, Store } from './types';

export const money = (amount: number) => new Intl.NumberFormat('ko-KR').format(amount);
export const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
export const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const validDate = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
export const dateLabel = (date: string, full = false) =>
  new Intl.DateTimeFormat('ko-KR', {
    year: full ? 'numeric' : undefined,
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date(`${date}T12:00:00+09:00`));
export const validEntry = (entry: Entry) =>
  entry.name.trim().length > 0 &&
  entry.name.length <= 80 &&
  entry.service.length <= 500 &&
  entry.amount !== null &&
  Number.isSafeInteger(entry.amount) &&
  entry.amount >= 0 &&
  entry.amount <= 100_000_000;
export const totalAmount = (entries: Entry[]) =>
  entries.reduce((sum, entry) => sum + (entry.amount ?? 0), 0);
const singleLine = (text: string) => text.trim().replace(/[\r\n\t]+/g, ' ');

export function buildReport(draft: Draft, settings: Settings): string {
  const sample = draft.entries.some((entry) => entry.source === 'sample');
  const lines = draft.entries.map(
    (entry, index) =>
      `${settings.compact ? '' : `${index + 1}. `}${singleLine(entry.name)}${settings.includeService && entry.service.trim() ? ` / ${singleLine(entry.service)}` : ''} · ${money(entry.amount ?? 0)}원`,
  );
  return `[${singleLine(settings.salonName)}${sample ? ' · 샘플' : ''}] ${draft.date.replaceAll('-', '.')} 마감\n\n${lines.join('\n')}\n\n총 ${draft.entries.length}건 · ${money(totalAmount(draft.entries))}원${settings.compact ? '' : '\n오늘도 수고하셨습니다.'}`;
}

export const initialStore = (): Store => ({
  version: 1,
  draft: { date: today(), entries: [] },
  settings: { salonName: '우리 매장', nameMode: 'customer', includeService: true, compact: false },
  history: [],
});
export const STORAGE_KEY = 'magam-beauty:v1';

export function loadStore(): { store: Store; warning: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { store: initialStore(), warning: '' };
    const data = JSON.parse(raw) as Store;
    if (
      data.version !== 1 ||
      !validDate(data.draft?.date) ||
      !Array.isArray(data.draft?.entries) ||
      data.draft.entries.length > 200 ||
      !data.draft.entries.every(
        (entry) =>
          typeof entry.id === 'string' &&
          typeof entry.name === 'string' &&
          typeof entry.service === 'string' &&
          typeof entry.source === 'string' &&
          typeof entry.needsReview === 'boolean' &&
          (entry.amount === null ||
            (Number.isSafeInteger(entry.amount) &&
              entry.amount >= 0 &&
              entry.amount <= 100_000_000)),
      ) ||
      typeof data.settings?.salonName !== 'string' ||
      !['customer', 'stylist', 'both'].includes(data.settings.nameMode) ||
      typeof data.settings.includeService !== 'boolean' ||
      typeof data.settings.compact !== 'boolean' ||
      !Array.isArray(data.history) ||
      !data.history.every(
        (report) =>
          typeof report.id === 'string' &&
          validDate(report.date) &&
          typeof report.text === 'string' &&
          Number.isSafeInteger(report.total) &&
          Number.isInteger(report.count) &&
          typeof report.createdAt === 'string' &&
          typeof report.sample === 'boolean',
      )
    ) {
      throw new Error('Invalid storage');
    }
    return { store: data, warning: '' };
  } catch {
    return {
      store: initialStore(),
      warning: '저장된 내역을 불러오지 못했습니다. 브라우저의 저장 공간 설정을 확인해 주세요.',
    };
  }
}

export function sampleEntries(): Entry[] {
  return [
    { name: '김민지', service: '디자인 커트', amount: 45000 },
    { name: '이서연', service: '컬러 + 클리닉', amount: 120000 },
    { name: '박지훈', service: '남성 커트', amount: 33000 },
  ].map((entry) => ({ ...entry, id: uid(), needsReview: false, source: 'sample' }));
}
