import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Camera,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Copy,
  FileText,
  History,
  Leaf,
  LoaderCircle,
  Plus,
  ReceiptText,
  RotateCcw,
  Settings2,
  Share2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import Modal from './components/Modal';
import { copyText, downloadText, extractReceipt, getHealth, request } from './lib/api';
import {
  buildReport,
  dateLabel,
  loadStore,
  money,
  sampleEntries,
  STORAGE_KEY,
  today,
  totalAmount,
  uid,
  validDate,
  validEntry,
} from './lib/domain';
import type {
  Entry,
  Health,
  Report,
  SavedReport,
  SaveRecordRequest,
  Settings,
  Store,
  Tab,
} from './lib/types';

type UploadItem = {
  id: string;
  file: File;
  url: string;
  status: 'waiting' | 'loading' | 'done' | 'error';
  error?: string;
  count?: number;
};
const tabs: { id: Tab; label: string; icon: typeof ReceiptText }[] = [
  { id: 'today', label: '오늘의 마감', icon: ReceiptText },
  { id: 'history', label: '마감 기록', icon: History },
  { id: 'settings', label: '설정', icon: Settings2 },
];
const nameLabels = { customer: '고객 이름', stylist: '디자이너 이름', both: '고객 · 디자이너' };
const currentTab = (): Tab =>
  ['today', 'history', 'settings'].includes(location.hash.slice(1))
    ? (location.hash.slice(1) as Tab)
    : 'today';

export default function App() {
  const [loaded] = useState(loadStore);
  const [store, setStore] = useState<Store>(loaded.store);
  const [tab, setTab] = useState<Tab>(currentTab);
  const [health, setHealth] = useState<Health | null>(null);
  const [connectionChecked, setConnectionChecked] = useState(false);
  const [storageWarning, setStorageWarning] = useState(loaded.warning);
  const [accessKey, setAccessKey] = useState(() => {
    try {
      return sessionStorage.getItem('magam-access-key') ?? '';
    } catch {
      return '';
    }
  });
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const uploadRef = useRef<UploadItem[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState<{ text: string; error: boolean } | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [modal, setModal] = useState<'report' | 'help' | 'clear' | 'clear-history' | null>(null);
  const [viewing, setViewing] = useState<SavedReport | null>(null);
  const [viewImage, setViewImage] = useState<UploadItem | null>(null);
  const [generatedText, setGeneratedText] = useState('');
  const [historyQuery, setHistoryQuery] = useState('');
  const [databaseHistory, setDatabaseHistory] = useState<SavedReport[]>([]);
  const [historySource, setHistorySource] = useState<'browser' | 'database'>('browser');
  const [historyError, setHistoryError] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savePayload, setSavePayload] = useState<SaveRecordRequest | null>(null);
  const databaseMode = useRef(false);

  const { draft, settings } = store;
  const history = historySource === 'database' ? databaseHistory : store.history;
  const total = totalAmount(draft.entries);
  const reviewCount = draft.entries.filter(
    (entry) => !validEntry(entry) || entry.needsReview,
  ).length;
  const ready =
    draft.entries.length > 0 &&
    reviewCount === 0 &&
    settings.salonName.trim().length > 0 &&
    validDate(draft.date);
  const hasSample = draft.entries.some((entry) => entry.source === 'sample');
  const notify = (text: string, error = false) => setToast({ text, error });

  useEffect(() => {
    const onHash = () => setTab(currentTab());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    let active = true;
    getHealth()
      .then((value) => {
        if (active) {
          setHealth(value);
          if (value.databaseEnabled) {
            databaseMode.current = true;
            setHistorySource('database');
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setConnectionChecked(true);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (historySource !== 'database' || tab !== 'history') return;
    let active = true;
    setHistoryLoading(true);
    setHistoryError('');
    setDatabaseHistory([]);
    request<SavedReport[]>('/closing-records?limit=100', {
      headers: { 'X-Access-Key': accessKey },
    })
      .then((records) => {
        if (!active) return;
        setDatabaseHistory(records);
        setHistoryHasMore(records.length === 100);
      })
      .catch((error: Error) => {
        if (active) setHistoryError(error.message);
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [historySource, tab, accessKey, historyRefresh]);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      setStorageWarning(
        '브라우저에 저장하지 못했습니다. 창을 닫기 전에 마감 문구를 복사하거나 다운로드해 주세요.',
      );
    }
  }, [store]);
  useEffect(() => {
    uploadRef.current = uploads;
  }, [uploads]);
  useEffect(
    () => () => {
      uploadRef.current.forEach((item) => URL.revokeObjectURL(item.url));
    },
    [],
  );
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  function navigate(next: Tab) {
    location.hash = next;
    setTab(next);
  }
  function updateSettings(patch: Partial<Settings>) {
    setStore((value) => ({ ...value, settings: { ...value.settings, ...patch } }));
  }
  function updateEntry(id: string, patch: Partial<Entry>) {
    setStore((value) => ({
      ...value,
      draft: {
        ...value.draft,
        entries: value.draft.entries.map((entry) =>
          entry.id === id
            ? { ...entry, ...patch, needsReview: patch.needsReview ?? entry.source !== 'manual' }
            : entry,
        ),
      },
    }));
  }
  function addManual() {
    if (draft.entries.length >= 200) {
      notify('한 번에 최대 200건까지 정리할 수 있어요.', true);
      return;
    }
    setStore((value) => ({
      ...value,
      draft: {
        ...value.draft,
        entries: [
          ...value.draft.entries,
          { id: uid(), name: '', service: '', amount: null, needsReview: false, source: 'manual' },
        ],
      },
    }));
    setTimeout(
      () => document.querySelector<HTMLInputElement>('.entry-row:last-child input')?.focus(),
      50,
    );
  }
  function clearDraft() {
    uploads.forEach((item) => URL.revokeObjectURL(item.url));
    setUploads([]);
    setWarnings([]);
    setStore((value) => ({ ...value, draft: { date: today(), entries: [] } }));
    setModal(null);
    notify('새로운 마감을 시작합니다.');
  }
  async function processUploads(items: UploadItem[]) {
    if (busy) return;
    setBusy(true);
    let added = 0;
    let available = 200 - draft.entries.length;
    for (const item of items) {
      setUploads((value) =>
        value.map((existing) =>
          existing.id === item.id ? { ...existing, status: 'loading', error: undefined } : existing,
        ),
      );
      try {
        const result = await extractReceipt(item.file, settings.nameMode, accessKey);
        if (result.entries.length === 0)
          throw new Error(result.warnings.join(' ') || '영수증에서 시술 내역을 찾지 못했습니다.');
        if (result.entries.length > available)
          throw new Error('최대 200건을 초과합니다. 현재 마감을 저장한 뒤 다시 시도해 주세요.');
        available -= result.entries.length;
        const entries = result.entries.map((entry) => ({
          ...entry,
          id: uid(),
          source: `receipt:${item.file.name}`,
          needsReview: true,
        }));
        setStore((value) => ({
          ...value,
          draft: { ...value.draft, entries: [...value.draft.entries, ...entries] },
        }));
        setWarnings((value) => [...new Set([...value, ...result.warnings])]);
        setUploads((value) =>
          value.map((existing) =>
            existing.id === item.id
              ? { ...existing, status: 'done', count: entries.length }
              : existing,
          ),
        );
        added += entries.length;
      } catch (error) {
        const message = error instanceof Error ? error.message : '사진 인식에 실패했습니다.';
        setUploads((value) =>
          value.map((existing) =>
            existing.id === item.id ? { ...existing, status: 'error', error: message } : existing,
          ),
        );
      }
    }
    setBusy(false);
    if (added) notify(`${added}건을 불러왔어요. 이름과 금액을 확인해 주세요.`);
  }
  async function selectFiles(files: FileList | File[]) {
    if (busy) return;
    if (hasSample) {
      notify('샘플 체험을 마친 뒤 ‘새 마감’으로 실제 영수증을 정리해 주세요.', true);
      return;
    }
    const selected = Array.from(files);
    if (selected.length > 5) {
      notify('사진은 한 번에 최대 5장까지 선택해 주세요.', true);
      return;
    }
    if (uploads.length + selected.length > 30) {
      notify('마감 한 번에 사진 30장까지 올릴 수 있어요.', true);
      return;
    }
    const items: UploadItem[] = [];
    for (const file of selected) {
      if (
        uploads.some(
          (item) =>
            item.file.name === file.name &&
            item.file.size === file.size &&
            item.file.lastModified === file.lastModified,
        ) ||
        items.some(
          (item) =>
            item.file.name === file.name &&
            item.file.size === file.size &&
            item.file.lastModified === file.lastModified,
        )
      ) {
        notify('이미 추가한 사진은 제외했어요. 실패한 사진은 다시 시도를 눌러 주세요.');
        continue;
      }
      items.push({ id: uid(), file, url: URL.createObjectURL(file), status: 'waiting' });
    }
    setUploads((value) => [...value, ...items]);
    await processUploads(items);
  }
  async function openReport() {
    if (!ready || busy) return;
    setGenerating(true);
    try {
      const payload: SaveRecordRequest = {
        id: crypto.randomUUID
          ? crypto.randomUUID()
          : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
              const n = crypto.getRandomValues(new Uint8Array(1))[0] & 15;
              return (c === 'x' ? n : (n & 3) | 8).toString(16);
            }),
        sample: hasSample,
        report: {
          date: draft.date,
          salonName: settings.salonName + (hasSample ? ' · 샘플' : ''),
          entries: draft.entries.map(({ name, service, amount, needsReview }) => ({
            name,
            service,
            amount,
            needsReview,
          })),
          includeService: settings.includeService,
          compact: settings.compact,
        },
      };
      let text = buildReport(draft, settings);
      if (health) {
        const result = await request<Report>('/reports/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload.report),
        });
        text = result.text;
      }
      setGeneratedText(text);
      setSavePayload(payload);
      setModal('report');
    } catch (error) {
      notify(error instanceof Error ? error.message : '마감 문구를 만들지 못했습니다.', true);
    } finally {
      setGenerating(false);
    }
  }
  async function saveReport() {
    if (saving || !savePayload) return;
    if (health?.databaseEnabled || databaseMode.current) {
      databaseMode.current = true;
      setSaving(true);
      try {
        await request<SavedReport>('/closing-records', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Access-Key': accessKey },
          body: JSON.stringify(savePayload),
        });
        setHistorySource('database');
        setHistoryRefresh((value) => value + 1);
        notify('마감 기록을 DB에 저장했어요.');
      } catch (error) {
        notify((error as Error).message, true);
      } finally {
        setSaving(false);
      }
      return;
    }
    // Do not silently switch to browser storage when the server cannot be checked.
    if (!health) {
      notify('서버 연결을 확인한 후 다시 저장해 주세요.', true);
      return;
    }
    if (history.some((report) => report.text === generatedText)) {
      notify('이미 저장된 마감 문구입니다.');
      return;
    }
    const report: SavedReport = {
      id: uid(),
      date: draft.date,
      text: generatedText,
      total,
      count: draft.entries.length,
      createdAt: new Date().toISOString(),
      sample: hasSample,
    };
    setStore((value) => ({ ...value, history: [report, ...value.history].slice(0, 100) }));
    notify('마감 기록을 이 브라우저에 저장했어요.');
  }
  async function deleteViewedRecord() {
    if (!viewing || deleting) return;
    setDeleting(true);
    try {
      if (historySource === 'database') {
        await request(`/closing-records/${viewing.id}`, {
          method: 'DELETE',
          headers: { 'X-Access-Key': accessKey },
        });
        setHistoryRefresh((value) => value + 1);
      } else {
        setStore((value) => ({
          ...value,
          history: value.history.filter((report) => report.id !== viewing.id),
        }));
      }
      setViewing(null);
      notify('마감 기록을 삭제했어요.');
    } catch (error) {
      notify((error as Error).message, true);
    } finally {
      setDeleting(false);
    }
  }
  async function loadMoreHistory() {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const records = await request<SavedReport[]>(
        `/closing-records?limit=100&offset=${databaseHistory.length}`,
        {
          headers: { 'X-Access-Key': accessKey },
        },
      );
      setDatabaseHistory((value) => [
        ...value,
        ...records.filter((record) => !value.some((item) => item.id === record.id)),
      ]);
      setHistoryHasMore(records.length === 100);
    } catch (error) {
      setHistoryError((error as Error).message);
    } finally {
      setHistoryLoading(false);
    }
  }
  async function copy(text: string) {
    try {
      await copyText(text);
      notify('복사했어요. 카카오톡이나 문자에 붙여넣어 주세요.');
    } catch (error) {
      notify((error as Error).message, true);
    }
  }
  async function share(text: string) {
    if (!navigator.share) {
      await copy(text);
      return;
    }
    try {
      await navigator.share({ title: 'Magam Beauty 마감', text });
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError'))
        notify('공유하지 못했습니다. 텍스트 복사를 이용해 주세요.', true);
    }
  }

  const reportActions = (text: string, date: string) => (
    <div className="report-actions">
      <button className="button primary" onClick={() => void copy(text)}>
        <Copy size={17} />
        텍스트 복사
      </button>
      <button className="button secondary" onClick={() => void share(text)}>
        <Share2 size={17} />
        공유
      </button>
      <button
        className="icon-button outlined"
        onClick={() => downloadText(text, date)}
        aria-label="텍스트 파일 다운로드"
      >
        <ArrowDownToLine size={19} />
      </button>
    </div>
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a href="#today" className="brand" aria-label="Magam Beauty 홈">
          <span className="brand-mark">
            m<span>✦</span>
          </span>
          <span>
            magam<span className="brand-beauty">BEAUTY</span>
          </span>
        </a>
        <div className="workspace-label">MY WORKSPACE</div>
        <nav aria-label="주 메뉴">
          {tabs.map(({ id, label, icon: Icon }) => (
            <a
              href={`#${id}`}
              key={id}
              className={`nav-item ${tab === id ? 'active' : ''}`}
              aria-current={tab === id ? 'page' : undefined}
            >
              <Icon size={19} />
              <span>{label}</span>
              {id === 'today' && <span className="nav-dot" />}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Leaf size={21} />
            <p>
              마감은 가볍게,
              <br />
              나의 시간은 더 길게.
            </p>
            <span>A LITTLE MORE TIME FOR YOU</span>
          </div>
          <button className="help-link" onClick={() => setModal('help')}>
            <CircleHelp size={18} /> 이용 가이드 <ChevronRight size={15} />
          </button>
          <div className="sidebar-version">
            Magam Beauty <span>v1.0</span>
          </div>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <span>워크스페이스</span>
            <ChevronRight size={14} />
            <strong>{tabs.find((item) => item.id === tab)?.label}</strong>
          </div>
          <a href="#today" className="mobile-brand">
            magam <span>beauty</span>
          </a>
          <button className="salon-button" onClick={() => navigate('settings')}>
            <span className="salon-avatar">{settings.salonName.trim().slice(0, 1) || 'M'}</span>
            <span>{settings.salonName || '매장 설정'}</span>
            <ChevronRight size={14} />
          </button>
        </header>
        <main>
          {storageWarning && (
            <div className="notice warning" role="alert">
              {storageWarning}
            </div>
          )}
          {tab === 'today' && (
            <>
              <section className="page-heading">
                <div>
                  <div className="eyebrow">
                    <span /> YOUR DAY, BEAUTIFULLY CLOSED
                  </div>
                  <h1>
                    오늘의 마감, <span>가볍게 끝내세요.</span>
                  </h1>
                  <p>영수증을 올리고, 확인하고, 공유하면 끝. 오늘도 수고 많으셨어요.</p>
                </div>
                <button
                  className="button new-close"
                  disabled={busy}
                  onClick={() =>
                    draft.entries.length || uploads.length ? setModal('clear') : clearDraft()
                  }
                >
                  <Plus size={17} /> 새 마감
                </button>
              </section>

              <div className="workspace-grid">
                <div className="work-column">
                  <section className="card upload-card">
                    <div className="card-heading">
                      <div className="section-title">
                        <span className="step-number">01</span>
                        <h2>영수증 업로드</h2>
                      </div>
                      <span className="small-badge">
                        <Sparkles size={12} /> AI 자동 정리
                      </span>
                    </div>
                    <div
                      className={`dropzone ${dragging ? 'dragging' : ''} ${busy ? 'processing' : ''}`}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDragging(true);
                      }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={(event) => {
                        event.preventDefault();
                        setDragging(false);
                        void selectFiles(event.dataTransfer.files);
                      }}
                    >
                      <div className="receipt-illustration" aria-hidden="true">
                        <div className="receipt-paper">
                          <span className="receipt-mini-logo">m.</span>
                          <i />
                          <i />
                          <i />
                          <div className="receipt-mini-total" />
                          <div className="receipt-barcode" />
                        </div>
                        <span className="receipt-sparkle">✦</span>
                        <div className="receipt-check">
                          <Check size={17} strokeWidth={3} />
                        </div>
                      </div>
                      <h3>{busy ? '영수증을 읽고 있어요' : '영수증 한 장으로, 간편한 마감'}</h3>
                      <p>
                        {busy ? (
                          '사진마다 차례로 정리하고 있어요. 잠시만 기다려 주세요.'
                        ) : (
                          <>
                            사진을 선택하거나 이곳에 끌어다 놓으세요.
                            <br className="mobile-only" /> 여러 장도 한 번에 정리해 드려요.
                          </>
                        )}
                      </p>
                      <div className="upload-buttons">
                        <button
                          className="button primary"
                          disabled={busy}
                          onClick={() => fileInput.current?.click()}
                        >
                          {busy ? (
                            <LoaderCircle className="spin" size={17} />
                          ) : (
                            <Upload size={17} />
                          )}
                          사진 선택하기
                        </button>
                        <button
                          className="button camera-button"
                          disabled={busy}
                          onClick={() => cameraInput.current?.click()}
                        >
                          <Camera size={18} />
                          <span>촬영하기</span>
                        </button>
                      </div>
                      <span className="file-hint">JPG, PNG, WEBP · 장당 10MB · 한 번에 5장</span>
                      <input
                        ref={fileInput}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        hidden
                        onChange={(event) => {
                          if (event.target.files) void selectFiles(event.target.files);
                          event.target.value = '';
                        }}
                        aria-label="영수증 사진 선택"
                      />
                      <input
                        ref={cameraInput}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        hidden
                        onChange={(event) => {
                          if (event.target.files) void selectFiles(event.target.files);
                          event.target.value = '';
                        }}
                        aria-label="영수증 촬영"
                      />
                    </div>
                    {uploads.length > 0 && (
                      <div className="upload-list" aria-live="polite">
                        {uploads.map((item) => (
                          <div className={`upload-item ${item.status}`} key={item.id}>
                            <button
                              className="upload-thumbnail"
                              onClick={() => setViewImage(item)}
                              aria-label={`${item.file.name} 사진 보기`}
                            >
                              <img src={item.url} alt="영수증 미리보기" />
                            </button>
                            <div className="upload-item-info">
                              <strong>{item.file.name}</strong>
                              <span>
                                {item.status === 'loading'
                                  ? '이름과 금액을 읽는 중…'
                                  : item.status === 'done'
                                    ? `${item.count}건 정리 완료 · 아래 내역을 확인해 주세요`
                                    : item.status === 'error'
                                      ? item.error
                                      : '인식 대기 중'}
                              </span>
                            </div>
                            {item.status === 'loading' ? (
                              <LoaderCircle size={17} className="spin" />
                            ) : item.status === 'done' ? (
                              <CheckCheck size={18} />
                            ) : item.status === 'error' ? (
                              <button
                                className="icon-button"
                                disabled={busy}
                                onClick={() => void processUploads([item])}
                                aria-label={`${item.file.name} 다시 시도`}
                              >
                                <RotateCcw size={16} />
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="upload-footer">
                      <span>
                        <ShieldCheck size={14} />
                        사진은 인식을 위해 OpenAI로 전송됩니다.
                      </span>
                      <button
                        className="text-button"
                        disabled={busy || draft.entries.length > 0}
                        onClick={() => {
                          setStore((value) => ({
                            ...value,
                            draft: { ...value.draft, entries: sampleEntries() },
                          }));
                          notify('실제 영수증이 아닌 샘플 내역입니다. 자유롭게 체험해 보세요.');
                        }}
                      >
                        샘플로 체험하기 <ArrowRight size={14} />
                      </button>
                    </div>
                    {connectionChecked && !health?.recognitionAvailable && (
                      <div className="connection-note">
                        <span className="status-dot muted" />
                        {health
                          ? '자동 인식 연결 전이에요. 샘플 체험과 직접 입력을 이용해 보세요.'
                          : '서버에 연결되지 않았어요. 샘플 체험과 직접 입력은 사용할 수 있어요.'}
                        <button
                          className="text-button"
                          onClick={() => {
                            setConnectionChecked(false);
                            getHealth()
                              .then((value) => {
                                setHealth(value);
                                notify(
                                  value.recognitionAvailable
                                    ? '자동 인식이 연결되었어요.'
                                    : '서버가 연결되었어요. 자동 인식은 설정이 필요합니다.',
                                );
                              })
                              .catch(() => notify('서버를 실행한 뒤 다시 확인해 주세요.', true))
                              .finally(() => setConnectionChecked(true));
                          }}
                        >
                          다시 확인
                        </button>
                      </div>
                    )}
                  </section>

                  <section className="card entries-card">
                    <div className="card-heading">
                      <div className="section-title">
                        <span className="step-number">02</span>
                        <h2>시술 내역 확인</h2>
                        <span className="count-badge">{draft.entries.length}</span>
                      </div>
                      <button
                        className="text-button"
                        disabled={busy || hasSample}
                        onClick={addManual}
                      >
                        <Plus size={15} />
                        직접 추가
                      </button>
                    </div>
                    {draft.entries.length === 0 ? (
                      <div className="empty-entries">
                        <div className="empty-icon">
                          <ReceiptText size={26} strokeWidth={1.3} />
                        </div>
                        <h3>오늘의 내역이 여기에 모여요</h3>
                        <p>
                          영수증을 올리면 이름과 시술금액을 정리해 드려요.
                          <br />
                          영수증이 없다면 직접 추가할 수도 있어요.
                        </p>
                        <button className="text-button" onClick={addManual}>
                          첫 내역 직접 입력 <ArrowRight size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        {hasSample && (
                          <div className="sample-strip">
                            <Sparkles size={14} />
                            샘플 체험 중 · 실제 마감은 ‘새 마감’으로 시작해 주세요.
                          </div>
                        )}
                        {warnings.map((warning, index) => (
                          <div className="notice warning inline-notice" key={index}>
                            {warning}
                          </div>
                        ))}
                        <div className="entries-table">
                          <div className="table-heading">
                            <span>{nameLabels[settings.nameMode]}</span>
                            <span>시술 내용</span>
                            <span>시술금액</span>
                            <span>확인</span>
                          </div>
                          {draft.entries.map((entry, index) => (
                            <div
                              className={`entry-row ${entry.needsReview ? 'needs-review' : ''}`}
                              key={entry.id}
                            >
                              <div className="entry-name">
                                <span className="row-index">
                                  {String(index + 1).padStart(2, '0')}
                                </span>
                                <input
                                  aria-label={`${index + 1}번 이름`}
                                  maxLength={80}
                                  placeholder="이름 입력"
                                  value={entry.name}
                                  onChange={(event) =>
                                    updateEntry(entry.id, { name: event.target.value })
                                  }
                                />
                              </div>
                              <input
                                className="service-input"
                                aria-label={`${index + 1}번 시술 내용`}
                                maxLength={120}
                                placeholder="시술 내용"
                                value={entry.service}
                                onChange={(event) =>
                                  updateEntry(entry.id, { service: event.target.value })
                                }
                              />
                              <div className="amount-input">
                                <input
                                  aria-label={`${index + 1}번 시술금액`}
                                  inputMode="numeric"
                                  placeholder="금액 입력"
                                  value={entry.amount === null ? '' : money(entry.amount)}
                                  onChange={(event) => {
                                    const digits = event.target.value.replace(/[^0-9]/g, '');
                                    const amount = digits ? Number(digits) : null;
                                    if (amount === null || amount <= 100_000_000)
                                      updateEntry(entry.id, { amount });
                                  }}
                                />
                                <span>원</span>
                              </div>
                              <div className="row-actions">
                                <button
                                  className={`verify-button ${!entry.needsReview && validEntry(entry) ? 'verified' : ''}`}
                                  disabled={!validEntry(entry)}
                                  onClick={() =>
                                    updateEntry(entry.id, {
                                      needsReview: !entry.needsReview && validEntry(entry),
                                    })
                                  }
                                  aria-label={`${index + 1}번 ${entry.needsReview ? '내역 확인' : '확인 상태 변경'}`}
                                >
                                  {!entry.needsReview && validEntry(entry) ? (
                                    <Check size={16} />
                                  ) : (
                                    '확인'
                                  )}
                                </button>
                                <button
                                  className="icon-button delete-row"
                                  disabled={busy}
                                  aria-label={`${index + 1}번 내역 삭제`}
                                  onClick={() =>
                                    setStore((value) => ({
                                      ...value,
                                      draft: {
                                        ...value.draft,
                                        entries: value.draft.entries.filter(
                                          (row) => row.id !== entry.id,
                                        ),
                                      },
                                    }))
                                  }
                                >
                                  <X size={15} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="table-footer">
                          <span>
                            {reviewCount > 0 ? (
                              `${reviewCount}건의 이름과 금액을 확인해 주세요.`
                            ) : (
                              <>
                                <CheckCheck size={15} /> 모든 내역을 확인했어요.
                              </>
                            )}
                          </span>
                          {reviewCount > 0 && (
                            <button
                              className="text-button"
                              onClick={() => {
                                setStore((value) => ({
                                  ...value,
                                  draft: {
                                    ...value.draft,
                                    entries: value.draft.entries.map((entry) =>
                                      validEntry(entry) ? { ...entry, needsReview: false } : entry,
                                    ),
                                  },
                                }));
                                if (draft.entries.some((entry) => !validEntry(entry)))
                                  notify('비어 있는 이름과 금액을 입력해 주세요.', true);
                              }}
                            >
                              전체 확인
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </section>
                  <div className="gentle-tip">
                    <span className="tip-icon">
                      <Leaf size={16} />
                    </span>
                    <p>
                      <strong>조금 더 편한 마감을 위한 팁</strong>영수증을 밝은 곳에서 반듯하게
                      찍으면 더 정확하게 정리할 수 있어요.
                    </p>
                  </div>
                </div>

                <aside className="summary-column">
                  <section className="summary-card">
                    <div className="summary-top">
                      <span>DAILY CLOSING</span>
                      <span className="summary-leaf">
                        <Leaf size={22} strokeWidth={1.4} />
                      </span>
                    </div>
                    <h2>하루의 수고를 한눈에</h2>
                    <label className="date-picker">
                      <input
                        type="date"
                        aria-label="마감 날짜"
                        value={draft.date}
                        disabled={busy}
                        onChange={(event) => {
                          if (validDate(event.target.value))
                            setStore((value) => ({
                              ...value,
                              draft: { ...value.draft, date: event.target.value },
                            }));
                        }}
                      />
                    </label>
                    <div className="summary-total-label">
                      총 시술금액 {hasSample && <span>샘플</span>}
                    </div>
                    <div className="summary-total">
                      <strong>{money(total)}</strong>
                      <span>원</span>
                    </div>
                    <div className="summary-divider" />
                    <div className="summary-stat">
                      <span>
                        <ReceiptText size={16} />
                        시술 내역
                      </span>
                      <strong>
                        {draft.entries.length}
                        <small>건</small>
                      </strong>
                    </div>
                    <div className="summary-stat">
                      <span>
                        <ClipboardCheck size={16} />
                        확인 완료
                      </span>
                      <strong>
                        {draft.entries.length - reviewCount}
                        <small>건</small>
                      </strong>
                    </div>
                    <div className="summary-bottom">
                      <span className="status-dot" />
                      {draft.entries.length === 0
                        ? '오늘의 첫 영수증을 기다리고 있어요'
                        : reviewCount > 0
                          ? `${reviewCount}건을 확인하면 마감 준비 완료`
                          : '좋아요, 이제 마감 문구를 만들어 보세요'}
                    </div>
                  </section>
                  <section className="card share-card">
                    <div className="section-title">
                      <span className="step-number">03</span>
                      <h2>마감 문구 만들기</h2>
                    </div>
                    <p>
                      정리된 내역을 텍스트로 만들고
                      <br />
                      카카오톡이나 문자로 공유하세요.
                    </p>
                    <div className={`mini-preview ${draft.entries.length ? 'has-entries' : ''}`}>
                      <div className="mini-preview-label">
                        <FileText size={13} /> 메시지 미리보기
                      </div>
                      {draft.entries.length > 0 ? (
                        <pre>{`[${settings.salonName}${hasSample ? ' · 샘플' : ''}] ${draft.date.replaceAll('-', '.')} 마감\n\n${draft.entries
                          .slice(0, 2)
                          .map(
                            (entry) =>
                              `${entry.name || '(이름 확인)'} · ${entry.amount === null ? '(금액 확인)' : `${money(entry.amount)}원`}`,
                          )
                          .join(
                            '\n',
                          )}${draft.entries.length > 2 ? `\n외 ${draft.entries.length - 2}건` : ''}\n\n총 ${draft.entries.length}건 · ${money(total)}원`}</pre>
                      ) : (
                        <>
                          <div className="preview-line long" />
                          <div className="preview-line" />
                          <div className="preview-line short" />
                          <span>내역을 추가하면 미리보기가 표시돼요.</span>
                        </>
                      )}
                    </div>
                    <button
                      className="button primary generate-button"
                      disabled={!ready || busy || generating}
                      onClick={() => void openReport()}
                    >
                      {generating ? (
                        <LoaderCircle size={17} className="spin" />
                      ) : (
                        <Copy size={17} />
                      )}
                      마감 문구 만들기
                      <ArrowRight size={16} />
                    </button>
                    <span className="share-hint">
                      {!settings.salonName.trim()
                        ? '설정에서 매장 이름을 입력해 주세요.'
                        : '공유 전, 이름과 금액을 한 번 더 확인해 주세요.'}
                    </span>
                  </section>
                  <div className="local-note">
                    <ShieldCheck size={15} />
                    <p>
                      작성 중인 내역은 이 브라우저에 저장돼요.
                      <br />
                      공용 기기에서는 이용 후 내역을 지워 주세요.
                    </p>
                  </div>
                </aside>
              </div>
            </>
          )}

          {tab === 'history' && (
            <>
              <section className="page-heading">
                <div>
                  <div className="eyebrow">
                    <span /> YOUR DAYS, WELL KEPT
                  </div>
                  <h1>
                    차곡차곡, <span>마감 기록.</span>
                  </h1>
                  <p>저장한 마감 문구를 다시 꺼내 보고 공유하세요.</p>
                </div>
                <button className="button secondary" onClick={() => navigate('today')}>
                  <Plus size={16} />
                  마감 작성
                </button>
              </section>
              <section className="card history-card">
                <div className="history-storage-controls">
                  <button
                    className="button secondary"
                    aria-pressed={historySource === 'database'}
                    onClick={() => setHistorySource('database')}
                  >
                    DB 기록
                  </button>
                  <button
                    className="button secondary"
                    aria-pressed={historySource === 'browser'}
                    onClick={() => setHistorySource('browser')}
                  >
                    이 브라우저 기록 ({store.history.length})
                  </button>
                  {historySource === 'database' && (
                    <button
                      className="text-button"
                      disabled={historyLoading}
                      onClick={() => setHistoryRefresh((value) => value + 1)}
                    >
                      새로고침
                    </button>
                  )}
                </div>
                {historySource === 'database' && (
                  <div className="history-storage-status" role="status">
                    {historyLoading
                      ? 'DB 기록을 불러오는 중이에요…'
                      : historyError ||
                        (!health?.databaseEnabled
                          ? 'DB 연결 설정을 먼저 완료해 주세요.'
                          : 'DB에 저장한 기록이에요. 검색은 현재 불러온 기록에서 진행해요.')}
                    {historyError && (
                      <button className="text-button" onClick={() => navigate('settings')}>
                        연결 설정 확인
                      </button>
                    )}
                  </div>
                )}
                <div className="card-heading">
                  <div className="section-title">
                    <History size={20} />
                    <h2>저장된 마감</h2>
                    <span className="count-badge">{history.length}</span>
                  </div>
                  <input
                    className="history-search"
                    type="search"
                    placeholder="날짜 또는 이름 검색"
                    aria-label="마감 기록 검색"
                    value={historyQuery}
                    onChange={(event) => setHistoryQuery(event.target.value)}
                  />
                </div>
                {history.length === 0 && !historyLoading && !historyError ? (
                  <div className="large-empty">
                    <div className="empty-icon">
                      <History size={28} />
                    </div>
                    <h3>하루의 기록을 남겨 보세요</h3>
                    <p>
                      마감 문구를 만든 뒤 ‘기록 저장’을 누르면
                      <br />
                      이곳에서 다시 확인할 수 있어요.
                    </p>
                    <button className="button primary" onClick={() => navigate('today')}>
                      오늘의 마감 시작
                      <ArrowRight size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="history-list">
                    {history
                      .filter((report) => `${report.date} ${report.text}`.includes(historyQuery))
                      .map((report) => (
                        <button
                          className="history-item"
                          key={report.id}
                          onClick={() => setViewing(report)}
                        >
                          <span className="history-icon">
                            <FileText size={23} />
                          </span>
                          <span className="history-item-info">
                            <strong>
                              {dateLabel(report.date, true)}
                              {report.sample && <small>샘플</small>}
                            </strong>
                            <span>{report.count}건의 시술 내역 · 저장 완료</span>
                          </span>
                          <strong className="history-amount">
                            {money(report.total)}
                            <small>원</small>
                          </strong>
                          <ChevronRight size={17} />
                        </button>
                      ))}
                    {!history.some((report) =>
                      `${report.date} ${report.text}`.includes(historyQuery),
                    ) && (
                      <div className="large-empty">
                        <p>검색 결과가 없어요. 다른 이름이나 날짜로 검색해 주세요.</p>
                      </div>
                    )}
                  </div>
                )}
                <div className="history-footer">
                  <ShieldCheck size={14} />
                  {historySource === 'database'
                    ? 'DB 기록은 같은 서버와 접속 키를 사용하는 기기에서 조회할 수 있어요.'
                    : '이 브라우저에 최근 100개 기록을 보관해요. 기기 간에는 공유되지 않아요.'}
                </div>
                {historySource === 'database' && historyHasMore && (
                  <button
                    className="button secondary"
                    disabled={historyLoading}
                    onClick={() => void loadMoreHistory()}
                  >
                    이전 기록 더 보기
                  </button>
                )}
              </section>
            </>
          )}

          {tab === 'settings' && (
            <>
              <section className="page-heading">
                <div>
                  <div className="eyebrow">
                    <span /> MAKE IT YOURS
                  </div>
                  <h1>
                    우리 매장에 <span>꼭 맞게.</span>
                  </h1>
                  <p>매장 정보와 마감 문구의 기본 형식을 설정하세요.</p>
                </div>
                <span className="autosave">
                  <CheckCheck size={16} />
                  자동 저장
                </span>
              </section>
              <div className="settings-grid">
                <section className="card settings-card">
                  <div className="section-title">
                    <Settings2 size={19} />
                    <h2>매장과 마감 설정</h2>
                  </div>
                  <label className="field-label">
                    매장 이름
                    <input
                      aria-label="매장 이름"
                      maxLength={50}
                      placeholder="예: 마감 헤어 성수점"
                      value={settings.salonName}
                      onChange={(event) => updateSettings({ salonName: event.target.value })}
                    />
                    <span>공유하는 마감 문구의 제목에 들어가요.</span>
                  </label>
                  <label className="field-label">
                    영수증에서 정리할 이름
                    <select
                      aria-label="영수증에서 정리할 이름"
                      value={settings.nameMode}
                      onChange={(event) =>
                        updateSettings({ nameMode: event.target.value as Settings['nameMode'] })
                      }
                    >
                      <option value="customer">고객 이름</option>
                      <option value="stylist">담당 디자이너 이름</option>
                      <option value="both">고객 이름 + 담당 디자이너</option>
                    </select>
                    <span>다음에 업로드하는 영수증부터 적용돼요.</span>
                  </label>
                  <label className="toggle-row">
                    <span>
                      <strong>시술 내용 포함</strong>
                      <small>이름, 시술 내용, 금액을 함께 공유해요.</small>
                    </span>
                    <input
                      type="checkbox"
                      role="switch"
                      checked={settings.includeService}
                      onChange={(event) => updateSettings({ includeService: event.target.checked })}
                    />
                    <span className="toggle-visual" />
                  </label>
                  <label className="toggle-row">
                    <span>
                      <strong>간결한 문구</strong>
                      <small>번호와 인사말을 생략하고 내역만 정리해요.</small>
                    </span>
                    <input
                      type="checkbox"
                      role="switch"
                      checked={settings.compact}
                      onChange={(event) => updateSettings({ compact: event.target.checked })}
                    />
                    <span className="toggle-visual" />
                  </label>
                </section>
                <div className="settings-side">
                  <section className="card settings-card">
                    <div className="section-title">
                      <Sparkles size={19} />
                      <h2>자동 인식 연결</h2>
                    </div>
                    <div
                      className={`service-status ${health?.recognitionAvailable ? 'connected' : ''}`}
                    >
                      <span className="status-dot" />
                      {health?.recognitionAvailable
                        ? '영수증 자동 인식 사용 가능'
                        : health
                          ? '자동 인식 설정 대기'
                          : '서버 연결 대기'}
                    </div>
                    <p className="settings-description">
                      자동 인식 연결 전에도 직접 입력과 마감 문구 작성을 사용할 수 있어요.
                    </p>
                    {health?.accessKeyRequired && (
                      <label className="field-label">
                        서비스 접속 키
                        <input
                          aria-label="서비스 접속 키"
                          type="password"
                          autoComplete="off"
                          value={accessKey}
                          placeholder="매장 관리자에게 받은 접속 키"
                          onChange={(event) => {
                            setAccessKey(event.target.value);
                            try {
                              sessionStorage.setItem('magam-access-key', event.target.value);
                            } catch {
                              /* Memory-only access remains available. */
                            }
                          }}
                        />
                        <span>이 브라우저 탭을 닫으면 저장된 접속 키가 지워져요.</span>
                      </label>
                    )}
                    <button
                      className="button secondary"
                      onClick={() => {
                        void getHealth()
                          .then((value) => {
                            setHealth(value);
                            if (value.databaseEnabled) databaseMode.current = true;
                            notify('연결 상태를 확인했어요.');
                          })
                          .catch(() => {
                            setHealth(null);
                            notify('서버에 연결하지 못했습니다.', true);
                          });
                      }}
                    >
                      <RotateCcw size={15} />
                      연결 상태 확인
                    </button>
                  </section>
                  <section className="card settings-card">
                    <div className="section-title">
                      <ShieldCheck size={19} />
                      <h2>데이터 관리</h2>
                    </div>
                    <p className="settings-description">
                      사진은 인식을 위해 OpenAI로 전송되며, 이 서비스의 서버에 영구 저장하지 않아요.
                      작성 중인 내역은 현재 브라우저에 보관돼요. DB 연결 후 저장하는 마감 기록은
                      서버에 보관돼요.
                    </p>
                    <p className="settings-description" role="status">
                      {!health
                        ? '서버 연결 상태를 먼저 확인해 주세요.'
                        : health.databaseEnabled
                          ? health.databaseAvailable
                            ? 'DB 연결 완료 · 기록 저장 시 DB에 보관합니다.'
                            : 'DB 연결 오류 · 연결 복구 후 다시 저장해 주세요.'
                          : 'DB 연결 대기 · 현재는 이 브라우저에 기록을 저장합니다.'}
                    </p>
                    <button
                      className="text-button danger"
                      disabled={store.history.length === 0}
                      onClick={() => setModal('clear-history')}
                    >
                      <Trash2 size={15} />이 브라우저 기록 전체 삭제
                    </button>
                  </section>
                </div>
              </div>
            </>
          )}
          <footer className="page-footer">
            <span>magam beauty</span>
            <p>하루의 끝에, 작은 여유를.</p>
            <span>MADE FOR YOUR BEAUTIFUL DAY</span>
          </footer>
        </main>
      </div>
      <nav className="mobile-nav" aria-label="모바일 메뉴">
        {tabs.map(({ id, label, icon: Icon }) => (
          <a
            href={`#${id}`}
            key={id}
            className={tab === id ? 'active' : ''}
            aria-current={tab === id ? 'page' : undefined}
          >
            <Icon size={21} />
            <span>{label}</span>
          </a>
        ))}
      </nav>

      {toast && (
        <div
          className={`toast ${toast.error ? 'toast-error' : ''}`}
          role={toast.error ? 'alert' : 'status'}
        >
          {toast.error ? <CircleHelp size={18} /> : <Check size={18} />}
          <span>{toast.text}</span>
          <button aria-label="알림 닫기" onClick={() => setToast(null)}>
            <X size={16} />
          </button>
        </div>
      )}
      {modal === 'report' && (
        <Modal title="오늘의 마감 문구" onClose={() => setModal(null)}>
          <p className="modal-description">이름과 금액을 확인하고, 원하는 곳에 공유하세요.</p>
          <textarea
            className="report-text"
            value={generatedText}
            readOnly
            aria-label="공유할 마감 문구"
          />
          {reportActions(generatedText, draft.date)}
          <button
            className="button save-button"
            disabled={saving}
            onClick={() => void saveReport()}
          >
            <History size={17} />
            {saving ? '저장 중…' : '기록 저장'}
          </button>
          <p className="modal-footnote">
            {health?.databaseEnabled || databaseMode.current
              ? 'DB에 이름, 시술금액과 마감 문구를 저장합니다.'
              : 'DB 설정 전에는 이 브라우저에 저장합니다.'}
          </p>
        </Modal>
      )}
      {viewing && (
        <Modal
          title={`${viewing.date.replaceAll('-', '.')} 마감 기록`}
          onClose={() => setViewing(null)}
        >
          <textarea
            className="report-text"
            value={viewing.text}
            readOnly
            aria-label="저장된 마감 문구"
          />
          {reportActions(viewing.text, viewing.date)}
          <button
            className="text-button danger record-delete"
            disabled={deleting}
            onClick={() => void deleteViewedRecord()}
          >
            <Trash2 size={15} />이 기록 삭제
          </button>
        </Modal>
      )}
      {viewImage && (
        <Modal title="영수증 원본 확인" onClose={() => setViewImage(null)} wide>
          <img className="receipt-full" src={viewImage.url} alt={viewImage.file.name} />
          <p className="modal-footnote">새로고침 후에는 원본 미리보기가 지워집니다.</p>
        </Modal>
      )}
      {modal === 'clear' && (
        <Modal title="새로운 마감을 시작할까요?" onClose={() => setModal(null)}>
          <p className="modal-description">
            작성 중인 내역과 사진이 지워져요. 보관하려면 먼저 마감 문구를 만들고 기록을 저장해
            주세요. 이미 저장한 마감 기록은 유지돼요.
          </p>
          <div className="dialog-actions">
            <button className="button secondary" onClick={() => setModal(null)}>
              계속 작성
            </button>
            <button className="button primary" onClick={clearDraft}>
              새 마감 시작
            </button>
          </div>
        </Modal>
      )}
      {modal === 'clear-history' && (
        <Modal title="마감 기록을 모두 삭제할까요?" onClose={() => setModal(null)}>
          <p className="modal-description">
            저장한 {store.history.length}개의 기록이 이 브라우저에서 삭제되며 복구할 수 없어요.
            필요한 문구는 먼저 다운로드해 주세요.
          </p>
          <div className="dialog-actions">
            <button className="button secondary" onClick={() => setModal(null)}>
              취소
            </button>
            <button
              className="button danger-button"
              onClick={() => {
                setStore((value) => ({ ...value, history: [] }));
                setModal(null);
                notify('저장된 마감 기록을 삭제했어요.');
              }}
            >
              전체 삭제
            </button>
          </div>
        </Modal>
      )}
      {modal === 'help' && (
        <Modal title="가벼운 마감, 이렇게 시작해요" onClose={() => setModal(null)}>
          <div className="guide-step">
            <span className="step-number">01</span>
            <div>
              <h3>영수증 사진을 올려 주세요</h3>
              <p>사진 선택 또는 촬영으로 최대 5장씩 올릴 수 있어요. JPG, PNG, WEBP를 지원해요.</p>
            </div>
          </div>
          <div className="guide-step">
            <span className="step-number">02</span>
            <div>
              <h3>이름과 금액을 확인해 주세요</h3>
              <p>
                잘못 읽힌 내용은 칸을 눌러 수정하고 ‘확인’을 눌러 주세요. 영수증에 없는 이름은 직접
                입력해 주세요.
              </p>
            </div>
          </div>
          <div className="guide-step">
            <span className="step-number">03</span>
            <div>
              <h3>마감 문구를 공유하세요</h3>
              <p>
                ‘마감 문구 만들기’를 누른 뒤 복사, 기기 공유, 텍스트 다운로드를 사용할 수 있어요.
                ‘기록 저장’으로 다시 확인할 수도 있어요.
              </p>
            </div>
          </div>
          <div className="notice">
            DB 연결 후 저장한 기록은 같은 서버와 접속 키로 다른 기기에서도 볼 수 있어요. 연결 전
            기록은 이 브라우저에 보관돼요.
          </div>
        </Modal>
      )}
    </div>
  );
}
