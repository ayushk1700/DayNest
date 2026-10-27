import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CSSProperties,
  DragEvent as ReactDragEvent,
  FormEvent as ReactFormEvent,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from 'react';
import { Icon } from '../ui/Icon';
import type { Name } from '../ui/Icon';
import { createStorageAdapter } from '../persistence/adapter';
import { canonicalTheme, isTheme } from '../state/model';
import { PdfPageSurface, PageThumbnail } from './PdfPageSurface';
import {
  PasswordResponses,
  exportPdf,
  isPasswordError,
  loadPdf,
  mergePdfs,
  savePdf,
} from './pdf-engine';
import type { PDFDocumentProxy } from './pdf-engine';
import { getRecentPdf, listRecentPdfs, removeRecentPdf, saveRecentPdf } from './pdf-recents';
import type { RecentPdfFile } from './pdf-recents';
import type { PdfMark, PdfPoint, PdfSession, PdfTool } from './pdf-types';

const toolNames: PdfTool[] = ['Highlight', 'Note', 'Draw', 'Eraser'];
const toolIcons: Record<PdfTool, Name> = {
  Read: 'hand',
  Select: 'cursor',
  Highlight: 'pencil',
  Note: 'sticky',
  Draw: 'pencil',
  Eraser: 'pencil',
};
const toolShortcut: Partial<Record<PdfTool, string>> = {
  Select: 'V',
  Highlight: 'H',
  Draw: 'D',
  Note: 'N',
  Eraser: 'E',
};
const markupColors = ['#e9ca69', '#e88767', '#9dbf9a', '#94b6d1', '#c5a1cc'];

function PdfToolIcon({ tool }: { tool: PdfTool }) {
  if (tool === 'Highlight')
    return (
      <svg
        className="pdf-highlighter-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m14.8 3.4 5.8 5.8-9.9 9.9H4.9v-5.8l9.9-9.9Z" />
        <path d="m10.1 8.1 5.8 5.8M4.9 19.1h15.2" />
      </svg>
    );
  if (tool === 'Eraser')
    return (
      <svg
        className="pdf-highlighter-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m8.5 4.5 11 11-5 5h-6l-5-5 11-11a3.5 3.5 0 0 1 4.9 0Z" />
        <path d="m7 17 5-5M14.5 20.5h5" />
      </svg>
    );
  return <Icon name={toolIcons[tool]} />;
}

function ColorPalette({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (color: string) => void;
  label: string;
}) {
  return (
    <div className="pdf-color-palette" role="group" aria-label={label}>
      {markupColors.map((color) => (
        <button
          key={color}
          type="button"
          className={'pdf-color-swatch' + (value === color ? ' is-active' : '')}
          style={{ '--swatch': color } as CSSProperties}
          aria-label={color}
          aria-pressed={value === color}
          title={color}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  );
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1) + ' MB';
}

function fileBaseName(name: string) {
  return name.replace(/\.pdf$/i, '');
}

function metadataText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : 'Not provided';
}

type RecentPdfSummary = Omit<RecentPdfFile, 'data'>;

function summarizeRecent(file: RecentPdfFile): RecentPdfSummary {
  return {
    id: file.id,
    name: file.name,
    size: file.size,
    lastOpened: file.lastOpened,
    title: file.title,
    author: file.author,
    pageCount: file.pageCount,
    ...(file.folder ? { folder: file.folder } : {}),
  };
}

function fileRecentId(file: File) {
  return `${file.webkitRelativePath || file.name}::${file.size}::${file.lastModified}`;
}

type BrowserPdfTab = {
  id?: number;
  windowId?: number;
  url?: string;
  title?: string;
  active?: boolean;
};
type BrowserTabsApi = {
  runtime?: { id?: string };
  tabs?: {
    query: (query: Record<string, never>) => Promise<BrowserPdfTab[]>;
    update: (tabId: number, properties: { active: boolean }) => Promise<BrowserPdfTab>;
    onCreated?: {
      addListener: (listener: (tab: BrowserPdfTab) => void) => void;
      removeListener: (listener: (tab: BrowserPdfTab) => void) => void;
    };
    onUpdated?: {
      addListener: (
        listener: (
          tabId: number,
          change: { url?: string; title?: string; status?: string },
          tab: BrowserPdfTab,
        ) => void,
      ) => void;
      removeListener: (
        listener: (
          tabId: number,
          change: { url?: string; title?: string; status?: string },
          tab: BrowserPdfTab,
        ) => void,
      ) => void;
    };
    onRemoved?: {
      addListener: (listener: (tabId: number) => void) => void;
      removeListener: (listener: (tabId: number) => void) => void;
    };
  };
  windows?: { update: (windowId: number, properties: { focused: boolean }) => Promise<unknown> };
  permissions?: {
    contains: (permissions: { permissions: string[] }) => Promise<boolean>;
    request: (permissions: { permissions: string[] }) => Promise<boolean>;
  };
};

function browserTabsApi(): BrowserTabsApi | null {
  const api = (globalThis as typeof globalThis & { chrome?: BrowserTabsApi }).chrome;
  return api?.runtime?.id && api.tabs ? api : null;
}

function isPdfBrowserTab(tab: BrowserPdfTab) {
  const value = `${tab.url ?? ''} ${tab.title ?? ''}`;
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    /* Keep the browser-provided value. */
  }
  return /\.pdf(?:$|[?#&\s])/i.test(decoded);
}

function browserPdfTabLocation(tab: BrowserPdfTab) {
  try {
    const url = new URL(tab.url ?? '');
    if (url.protocol === 'file:') return 'On this device';
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.hostname;
    if (url.protocol === 'chrome-extension:' && url.pathname.endsWith('/pdf.html'))
      return 'DayNest PDF Studio';
  } catch {
    /* Some built-in PDF viewers use internal URLs. */
  }
  return 'Open in browser';
}

function PdfFolderIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
      <path d="M3.8 10h16.4" />
    </svg>
  );
}

export function PdfStudio() {
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [session, setSession] = useState<PdfSession | null>(null);
  const [pageOrder, setPageOrder] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [activePage, setActivePage] = useState<Awaited<
    ReturnType<PDFDocumentProxy['getPage']>
  > | null>(null);
  const [zoom, setZoom] = useState(100);
  const [zoomMode, setZoomMode] = useState<'custom' | 'width' | 'page'>('width');
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [pageRotations, setPageRotations] = useState<number[]>([]);
  const [marks, setMarks] = useState<PdfMark[]>([]);
  const [tool, setTool] = useState<PdfTool>('Read');
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [navSidebarOpen, setNavSidebarOpen] = useState(true);
  const [recentFiles, setRecentFiles] = useState<RecentPdfSummary[]>([]);
  const [openPdfTabs, setOpenPdfTabs] = useState<BrowserPdfTab[]>([]);
  const [checkingPdfTabs, setCheckingPdfTabs] = useState(false);
  const [hasPdfTabPermission, setHasPdfTabPermission] = useState(false);
  const [pdfTabMessage, setPdfTabMessage] = useState('');
  const [folderInfo, setFolderInfo] = useState<{ name: string; pdfCount: number } | null>(null);
  const [highlightColor, setHighlightColor] = useState(markupColors[0]!);
  const [inkColor, setInkColor] = useState('#b45a4d');
  const [noteColor, setNoteColor] = useState('#e9ca69');
  const [highlightOpacity, setHighlightOpacity] = useState(0.4);
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [selectedMarkId, setSelectedMarkId] = useState<string | null>(null);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [pageMenu, setPageMenu] = useState<{ index: number; x: number; y: number } | null>(null);
  const [notice, setNotice] = useState('Open a PDF to begin.');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [passwordPrompt, setPasswordPrompt] = useState<{
    fileName: string;
    incorrect: boolean;
  } | null>(null);
  const [password, setPassword] = useState('');
  const [pendingNote, setPendingNote] = useState<PdfPoint | null>(null);
  const [noteText, setNoteText] = useState('');
  const [dirty, setDirty] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [searchIndex, setSearchIndex] = useState(0);
  const [searching, setSearching] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const mergeInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const readerStage = useRef<HTMLDivElement>(null);
  const thumbnailRefs = useRef(new Map<number, HTMLDivElement>());
  const panStart = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const wheelTurnLocked = useRef(false);
  const wheelTurnTimer = useRef<number | null>(null);
  const taskRef = useRef<ReturnType<typeof loadPdf> | null>(null);
  const documentTaskRef = useRef<ReturnType<typeof loadPdf> | null>(null);
  const passwordUpdater = useRef<((value: string) => void) | null>(null);
  const loadId = useRef(0);
  const markHistory = useRef<{ past: PdfMark[][]; future: PdfMark[][] }>({ past: [], future: [] });
  const sourcePage = pageOrder[page - 1] ?? 0;
  const pageRotation = pageRotations[page - 1] ?? 0;

  useEffect(() => {
    const storage = createStorageAdapter();
    const applyTheme = async () => {
      try {
        const raw = await storage.read();
        if (typeof raw !== 'string') return;
        const saved = JSON.parse(raw) as { theme?: unknown };
        if (isTheme(saved.theme))
          document.documentElement.dataset.theme = canonicalTheme(saved.theme);
      } catch {
        /* PDF Studio stays available with the default DayNest theme. */
      }
    };
    void applyTheme();
    return storage.subscribe(() => {
      void applyTheme();
    });
  }, []);

  useEffect(() => {
    let active = true;
    void listRecentPdfs()
      .then((files) => {
        if (!active) return;
        setRecentFiles(files.map(summarizeRecent));
        const latestFolder = files.find((file) => file.folder)?.folder;
        if (latestFolder)
          setFolderInfo({
            name: latestFolder,
            pdfCount: files.filter((file) => file.folder === latestFolder).length,
          });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = session
      ? `${session.fileName} · PDF Studio · DayNest`
      : 'PDF Studio · DayNest';
    return () => {
      document.title = previousTitle;
    };
  }, [session?.fileName]);

  const scanOpenPdfTabs = useCallback(async (requestAccess = false) => {
    const api = browserTabsApi();
    if (!api?.tabs || !api.permissions) return;
    setCheckingPdfTabs(true);
    setPdfTabMessage('');
    try {
      // Request permission directly from the user's button click. Daynest does not
      // inspect browser tabs until this explicit action has been chosen.
      const allowed = requestAccess
        ? await api.permissions.request({ permissions: ['tabs'] })
        : await api.permissions.contains({ permissions: ['tabs'] });
      setHasPdfTabPermission(allowed);
      if (!allowed) {
        setOpenPdfTabs([]);
        setPdfTabMessage('Allow tab access to find PDFs already open in your browser.');
        return;
      }
      const tabs = await api.tabs.query({});
      const found = tabs.filter((tab) => Number.isInteger(tab.id) && isPdfBrowserTab(tab));
      setOpenPdfTabs(found);
      setPdfTabMessage(found.length ? '' : 'No PDF tabs found.');
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message : '';
      setPdfTabMessage(
        /not.*optional|not.*declared|invalid permission|permission.*not.*allowed/i.test(detail)
          ? 'Reload Daynest to apply tab access, then try again.'
          : /user gesture|gesture/i.test(detail)
            ? 'Choose Find again and allow the browser permission prompt.'
            : 'Could not check tabs. Reload Daynest and try again.',
      );
    } finally {
      setCheckingPdfTabs(false);
    }
  }, []);

  useEffect(() => {
    const api = browserTabsApi();
    if (!api?.tabs || !api.permissions) return;
    let active = true;
    void api.permissions
      .contains({ permissions: ['tabs'] })
      .then((granted) => {
        if (!active) return;
        setHasPdfTabPermission(granted);
        if (granted) void scanOpenPdfTabs();
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [scanOpenPdfTabs]);

  useEffect(() => {
    const tabs = browserTabsApi()?.tabs;
    if (!tabs) return;
    let timer: number | undefined;
    const refreshSoon = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void scanOpenPdfTabs();
      }, 220);
    };
    const onCreated = () => refreshSoon();
    const onUpdated = (
      _tabId: number,
      change: { url?: string; title?: string; status?: string },
    ) => {
      if (change.url || change.title || change.status === 'complete') refreshSoon();
    };
    const onRemoved = () => refreshSoon();
    tabs.onCreated?.addListener(onCreated);
    tabs.onUpdated?.addListener(onUpdated);
    tabs.onRemoved?.addListener(onRemoved);
    return () => {
      window.clearTimeout(timer);
      tabs.onCreated?.removeListener(onCreated);
      tabs.onUpdated?.removeListener(onUpdated);
      tabs.onRemoved?.removeListener(onRemoved);
    };
  }, [scanOpenPdfTabs]);

  async function switchToPdfTab(tab: BrowserPdfTab) {
    const api = browserTabsApi();
    if (!api?.tabs || !Number.isInteger(tab.id)) return;
    try {
      if (Number.isInteger(tab.windowId))
        await api.windows?.update(tab.windowId!, { focused: true });
      await api.tabs.update(tab.id!, { active: true });
    } catch {
      setPdfTabMessage('That tab could not be focused. It may have been closed.');
      void scanOpenPdfTabs();
    }
  }

  useEffect(() => {
    folderInput.current?.setAttribute('webkitdirectory', '');
  }, []);

  useEffect(
    () => () => {
      loadId.current += 1;
      window.clearTimeout(wheelTurnTimer.current ?? undefined);
      void taskRef.current?.destroy();
      void documentTaskRef.current?.destroy();
    },
    [],
  );

  useEffect(() => {
    if (!pdfDocument || sourcePage <= 0) {
      setActivePage(null);
      return;
    }
    let active = true;
    void pdfDocument
      .getPage(sourcePage)
      .then((value) => {
        if (active) setActivePage(value);
      })
      .catch((reason) => {
        if (active)
          setError(reason instanceof Error ? reason.message : 'Could not read this page.');
      });
    return () => {
      active = false;
    };
  }, [pdfDocument, sourcePage]);

  useEffect(() => {
    const host = readerStage.current;
    if (!host || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) setStageSize({ width: box.width, height: box.height });
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, [pdfDocument]);

  useEffect(() => {
    readerStage.current?.scrollTo({ top: 0, left: 0 });
  }, [page]);
  useEffect(() => {
    thumbnailRefs.current
      .get(page - 1)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [page]);

  const baseViewport = useMemo(
    () =>
      activePage?.getViewport({ scale: 1, rotation: (activePage.rotate + pageRotation) % 360 }) ??
      null,
    [activePage, pageRotation],
  );
  const fitWidthScale =
    baseViewport && stageSize.width
      ? Math.min(2.5, Math.max(0.25, (stageSize.width - 64) / baseViewport.width))
      : 1;
  const fitPageScale =
    baseViewport && stageSize.width && stageSize.height
      ? Math.min(
          2.5,
          Math.max(0.25, (stageSize.width - 64) / baseViewport.width, 0.25),
          Math.max(0.25, (stageSize.height - 56) / baseViewport.height),
        )
      : fitWidthScale;
  const renderScale =
    zoomMode === 'width' ? fitWidthScale : zoomMode === 'page' ? fitPageScale : zoom / 100;
  const visibleZoom = Math.round(renderScale * 100);

  const announce = useCallback((message: string) => setNotice(message), []);

  function openFilePicker() {
    const picker = fileInput.current as (HTMLInputElement & { showPicker?: () => void }) | null;
    if (!picker) {
      setError('The file picker is not ready yet. Try Open PDF again.');
      return;
    }
    setError('');
    try {
      if (picker.showPicker) picker.showPicker();
      else picker.click();
    } catch {
      try {
        picker.click();
      } catch {
        setError('Your browser could not open the file picker.');
      }
    }
  }

  function openFolderPicker() {
    const picker = folderInput.current as (HTMLInputElement & { showPicker?: () => void }) | null;
    if (!picker) {
      setError('The folder picker is not ready yet. Try Open folder again.');
      return;
    }
    setError('');
    try {
      if (picker.showPicker) picker.showPicker();
      else picker.click();
    } catch {
      try {
        picker.click();
      } catch {
        setError('Your browser could not open the folder picker.');
      }
    }
  }

  async function openBytes(
    bytes: Uint8Array,
    fileName: string,
    fileSize = bytes.byteLength,
    recentId = `merged:${crypto.randomUUID()}`,
    folder?: string,
  ) {
    const currentId = ++loadId.current;
    if (taskRef.current) {
      const previousTask = taskRef.current;
      taskRef.current = null;
      await previousTask.destroy().catch(() => {});
    }
    setLoading(true);
    setLoadingProgress(0);
    setError('');
    setPasswordPrompt(null);
    setPassword('');
    const task = loadPdf(bytes);
    taskRef.current = task;
    task.onProgress = (progress: { loaded?: number; total?: number }) => {
      if (currentId !== loadId.current || !progress.total) return;
      setLoadingProgress(
        Math.min(100, Math.round(((progress.loaded ?? 0) * 100) / progress.total)),
      );
    };
    task.onPassword = (updatePassword: (value: string) => void, reason: number) => {
      passwordUpdater.current = updatePassword;
      setPasswordPrompt({ fileName, incorrect: reason === PasswordResponses.INCORRECT_PASSWORD });
      setPassword('');
      setTimeout(() => passwordInput.current?.focus(), 0);
    };
    try {
      const document = await task.promise;
      if (currentId !== loadId.current) {
        void task.destroy();
        return;
      }
      const metadata = (await document.getMetadata().catch(() => null)) as {
        info?: { Title?: unknown; Author?: unknown };
      } | null;
      const oldTask = documentTaskRef.current;
      documentTaskRef.current = task;
      setPdfDocument(document);
      setSession({
        bytes: bytes.slice(),
        fileName,
        fileSize,
        pageCount: document.numPages,
        title: metadataText(metadata?.info?.Title),
        author: metadataText(metadata?.info?.Author),
      });
      const recentFile: RecentPdfSummary = {
        id: recentId,
        name: fileName,
        size: fileSize,
        lastOpened: Date.now(),
        title: metadataText(metadata?.info?.Title),
        author: metadataText(metadata?.info?.Author),
        pageCount: document.numPages,
        ...(folder ? { folder } : {}),
      };
      setRecentFiles((current) =>
        [recentFile, ...current.filter((file) => file.id !== recentId)].slice(0, 8),
      );
      void saveRecentPdf({ ...recentFile, data: bytes })
        .then(() => listRecentPdfs().then((files) => setRecentFiles(files.map(summarizeRecent))))
        .catch(() => {});
      if (folder)
        setFolderInfo((current) => ({
          name: folder,
          pdfCount: Math.max(current?.name === folder ? current.pdfCount : 0, 1),
        }));
      setPageOrder(Array.from({ length: document.numPages }, (_, index) => index + 1));
      setPageRotations(Array.from({ length: document.numPages }, () => 0));
      setPage(1);
      setMarks([]);
      setSelectedMarkId(null);
      setDirty(false);
      setPendingNote(null);
      setTool('Read');
      setMobilePanelOpen(false);
      setSearchTerm('');
      setQuery('');
      setSearchResults([]);
      markHistory.current = { past: [], future: [] };
      passwordUpdater.current = null;
      announce(fileName + ' is ready.');
      if (oldTask && oldTask !== task) void oldTask.destroy();
    } catch (reason) {
      if (currentId !== loadId.current) return;
      if (isPasswordError(reason)) {
        setPasswordPrompt({
          fileName,
          incorrect: reason.code === PasswordResponses.INCORRECT_PASSWORD,
        });
      } else {
        const message = reason instanceof Error ? reason.message : 'This PDF could not be opened.';
        setError(
          message.includes('Invalid PDF')
            ? 'This file is damaged or is not a supported PDF.'
            : message,
        );
      }
      announce('Could not open ' + fileName + '.');
    } finally {
      if (currentId === loadId.current) {
        setLoading(false);
        setLoadingProgress(0);
        if (taskRef.current === task) taskRef.current = null;
      }
    }
  }

  function canReplaceDocument() {
    return (
      !dirty ||
      window.confirm(
        'Discard the unsaved PDF edits in this tab and open another file? The original PDF will stay unchanged.',
      )
    );
  }

  async function handleOpenFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter(
      (file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'),
    );
    if (files.length === 0) {
      setError('Choose a PDF file.');
      return;
    }
    if (!canReplaceDocument()) return;
    setError('');
    if (files.length > 1) {
      setLoading(true);
      announce('Combining ' + files.length + ' PDFs…');
      try {
        const combined = await mergePdfs(files, announce);
        await openBytes(
          combined,
          'Merged · ' + files[0]!.name,
          combined.byteLength,
          `merged:${crypto.randomUUID()}`,
        );
      } catch (reason) {
        setLoading(false);
        setError(reason instanceof Error ? reason.message : 'These PDFs could not be combined.');
      }
    } else {
      const file = files[0]!;
      const relativePath = file.webkitRelativePath;
      const folder = relativePath.includes('/') ? relativePath.split('/')[0] : undefined;
      await openBytes(
        new Uint8Array(await file.arrayBuffer()),
        file.name,
        file.size,
        fileRecentId(file),
        folder,
      );
    }
  }

  async function mergeIntoCurrent(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter(
      (file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'),
    );
    if (files.length === 0) {
      setError('Choose one or more PDFs to add.');
      return;
    }
    if (!session) {
      await handleOpenFiles(files);
      return;
    }
    if (
      dirty &&
      !window.confirm(
        'Merge these files with the original PDF and discard the unsaved markup in this tab?',
      )
    )
      return;
    setLoading(true);
    setError('');
    try {
      const current = new File([session.bytes.slice().buffer as ArrayBuffer], session.fileName, {
        type: 'application/pdf',
      });
      const combined = await mergePdfs([current, ...files], announce);
      await openBytes(
        combined,
        'Merged · ' + session.fileName,
        combined.byteLength,
        `merged:${crypto.randomUUID()}`,
      );
    } catch (reason) {
      setLoading(false);
      setError(reason instanceof Error ? reason.message : 'The selected PDFs could not be merged.');
    }
  }

  async function handleOpenFolder(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter(
      (file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'),
    );
    if (!files.length) {
      setError('No PDF files were found in that folder.');
      return;
    }
    const firstPath = files[0]!.webkitRelativePath;
    const folder = firstPath.includes('/') ? firstPath.split('/')[0]! : 'Selected folder';
    setFolderInfo({ name: folder, pdfCount: files.length });
    setError('');
    let stored = 0;
    const now = Date.now();
    try {
      for (let index = 0; index < Math.min(files.length, 8); index += 1) {
        const file = files[index]!;
        await saveRecentPdf({
          id: fileRecentId(file),
          name: file.name,
          size: file.size,
          title: 'Not provided',
          author: 'Not provided',
          pageCount: 0,
          folder,
          lastOpened: now + (8 - index),
          data: new Uint8Array(await file.arrayBuffer()),
        });
        stored += 1;
      }
      const recent = await listRecentPdfs();
      setRecentFiles(recent.map(summarizeRecent));
    } catch {
      setError('The folder is open, but some recent files could not be saved on this device.');
      const recent = await listRecentPdfs().catch(() => []);
      setRecentFiles(recent.map(summarizeRecent));
    }
    announce(`Found ${files.length} PDF${files.length === 1 ? '' : 's'} in ${folder}.`);
    if (!session) await handleOpenFiles([files[0]!]);
    else if (stored)
      announce(`Found ${files.length} PDFs in ${folder}. Choose one from Recents to open it.`);
  }

  async function openRecentFile(id: string) {
    if (!canReplaceDocument()) return;
    setError('');
    try {
      const recent = await getRecentPdf(id);
      if (!recent) {
        setError('This recent PDF is no longer available. Choose Open PDF to select it again.');
        return;
      }
      await openBytes(
        new Uint8Array(recent.data),
        recent.name,
        recent.size,
        recent.id,
        recent.folder,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not open this recent PDF.');
    }
  }

  async function forgetRecentFile(id: string) {
    try {
      await removeRecentPdf(id);
      setRecentFiles((current) => current.filter((file) => file.id !== id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not remove this recent PDF.');
    }
  }

  function submitPassword(event: ReactFormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password.trim()) {
      setError('Enter the PDF password to continue.');
      return;
    }
    passwordUpdater.current?.(password);
    setPasswordPrompt(null);
    setError('');
  }

  function cancelPassword() {
    loadId.current += 1;
    passwordUpdater.current = null;
    void taskRef.current?.destroy();
    taskRef.current = null;
    setPasswordPrompt(null);
    setPassword('');
    setLoading(false);
    announce('PDF opening cancelled.');
  }

  function performCloseDocument() {
    const currentTask = documentTaskRef.current;
    loadId.current += 1;
    const pendingTask = taskRef.current;
    taskRef.current = null;
    if (pendingTask) void pendingTask.destroy();
    documentTaskRef.current = null;
    setPdfDocument(null);
    setSession(null);
    setPageOrder([]);
    setPage(1);
    setActivePage(null);
    setMarks([]);
    setPageRotations([]);
    setSelectedMarkId(null);
    setDirty(false);
    setError('');
    setSearchResults([]);
    markHistory.current = { past: [], future: [] };
    if (currentTask) void currentTask.destroy();
    setCloseConfirmOpen(false);
    announce('PDF closed.');
  }

  function closeDocument() {
    if (dirty) {
      setCloseConfirmOpen(true);
      return;
    }
    performCloseDocument();
  }

  async function runSearch(event?: ReactFormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const term = query.trim();
    if (!pdfDocument || !term) {
      setSearchTerm('');
      setSearchResults([]);
      return;
    }
    setSearching(true);
    setError('');
    setSearchTerm(term);
    const found: number[] = [];
    try {
      for (let index = 0; index < pageOrder.length; index += 1) {
        const source = pageOrder[index];
        if (!source) continue;
        const text = await (await pdfDocument.getPage(source)).getTextContent();
        const combined = text.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ')
          .toLocaleLowerCase();
        if (combined.includes(term.toLocaleLowerCase())) found.push(index + 1);
      }
      setSearchResults(found);
      setSearchIndex(0);
      if (found[0]) {
        setPage(found[0]);
        announce(
          'Found “' + term + '” on ' + found.length + (found.length === 1 ? ' page.' : ' pages.'),
        );
      } else {
        announce('No matches found for “' + term + '”.');
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Search could not read this document.');
    } finally {
      setSearching(false);
    }
  }

  function moveSearchResult(direction: number) {
    if (!searchResults.length) return;
    const next = (searchIndex + direction + searchResults.length) % searchResults.length;
    setSearchIndex(next);
    setPage(searchResults[next] ?? 1);
  }

  function updateMarks(next: PdfMark[]) {
    markHistory.current.past.push(marks);
    if (markHistory.current.past.length > 50) markHistory.current.past.shift();
    markHistory.current.future = [];
    setMarks(next);
    setDirty(true);
  }

  function addMark(mark: PdfMark) {
    updateMarks([...marks, mark]);
    setSelectedMarkId(mark.id);
    setPendingNote(null);
    setNoteText('');
    announce(
      mark.type === 'highlight'
        ? 'Highlight added.'
        : mark.type === 'ink'
          ? 'Ink mark added.'
          : 'Note added.',
    );
  }

  function undoMark() {
    const previous = markHistory.current.past.pop();
    if (!previous) return;
    markHistory.current.future.push(marks);
    setMarks(previous);
    setDirty(true);
    announce('Last markup change undone.');
  }

  function redoMark() {
    const next = markHistory.current.future.pop();
    if (!next) return;
    markHistory.current.past.push(marks);
    setMarks(next);
    setDirty(true);
    announce('Markup change restored.');
  }

  function removeMark(id: string) {
    updateMarks(marks.filter((mark) => mark.id !== id));
    if (selectedMarkId === id) setSelectedMarkId(null);
    announce('Markup removed.');
  }

  function jumpToMark(mark: PdfMark) {
    setSelectedMarkId(mark.id);
    requestAnimationFrame(() =>
      document
        .getElementById('pdf-mark-' + mark.id)
        ?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' }),
    );
  }

  function chooseTool(next: PdfTool) {
    setTool(next);
    if (next === 'Highlight') announce('Drag across text or a region to highlight it.');
    else if (next === 'Note') announce('Choose a place on the page for your note.');
    else if (next === 'Draw' || next === 'Eraser')
      announce(next === 'Draw' ? 'Draw on the page.' : 'Click a markup to erase it.');
  }

  function showPageMenu(index: number, x: number, y: number) {
    const menuWidth = 190;
    const menuHeight = 218;
    setPageMenu({
      index,
      x: Math.max(8, Math.min(x, window.innerWidth - menuWidth - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - menuHeight - 8)),
    });
  }

  function startPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (!session || !pdfDocument || tool !== 'Read' || event.button !== 0) return;
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest(
        'button, a, input, textarea, select, [role="button"], [contenteditable="true"]',
      )
    )
      return;
    const host = readerStage.current;
    if (!host) return;
    panStart.current = {
      x: event.clientX,
      y: event.clientY,
      left: host.scrollLeft,
      top: host.scrollTop,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function movePan(event: ReactPointerEvent<HTMLDivElement>) {
    const start = panStart.current;
    const host = readerStage.current;
    if (!start || !host) return;
    host.scrollLeft = start.left - (event.clientX - start.x);
    host.scrollTop = start.top - (event.clientY - start.y);
  }

  function stopPan() {
    panStart.current = null;
  }

  function handleReaderWheel(event: ReactWheelEvent<HTMLDivElement>) {
    if (
      !session ||
      !pdfDocument ||
      event.ctrlKey ||
      Math.abs(event.deltaX) > Math.abs(event.deltaY)
    )
      return;
    const stage = readerStage.current;
    if (!stage) return;
    const atTop = stage.scrollTop <= 2;
    const atBottom = stage.scrollTop + stage.clientHeight >= stage.scrollHeight - 2;
    const direction = event.deltaY > 0 && atBottom ? 1 : event.deltaY < 0 && atTop ? -1 : 0;
    if (!direction || (direction > 0 && page >= pageOrder.length) || (direction < 0 && page <= 1))
      return;

    // Treat a trackpad or wheel burst as one page turn, even if it emits many events.
    event.preventDefault();
    if (wheelTurnLocked.current) {
      window.clearTimeout(wheelTurnTimer.current ?? undefined);
      wheelTurnTimer.current = window.setTimeout(() => {
        wheelTurnLocked.current = false;
        wheelTurnTimer.current = null;
      }, 360);
      return;
    }
    wheelTurnLocked.current = true;
    wheelTurnTimer.current = window.setTimeout(() => {
      wheelTurnLocked.current = false;
      wheelTurnTimer.current = null;
    }, 360);
    setPage((current) => Math.max(1, Math.min(pageOrder.length, current + direction)));
  }

  function movePage(from: number, to: number) {
    if (to < 0 || to >= pageOrder.length || from === to) return;
    const next = [...pageOrder];
    const nextRotations = [...pageRotations];
    const moved = next.splice(from, 1)[0];
    const movedRotation = nextRotations.splice(from, 1)[0] ?? 0;
    if (!moved) return;
    next.splice(to, 0, moved);
    nextRotations.splice(to, 0, movedRotation);
    setPageOrder(next);
    setPageRotations(nextRotations);
    setPage(to + 1);
    setDirty(true);
    announce('Page moved to position ' + (to + 1) + '.');
  }

  function deletePageAt(index: number) {
    if (pageOrder.length <= 1) {
      setError('A PDF must keep at least one page.');
      return;
    }
    const removed = pageOrder[index];
    if (!removed) return;
    const next = pageOrder.filter((_, current) => current !== index);
    const nextRotations = pageRotations.filter((_, current) => current !== index);
    setPageOrder(next);
    setPage((current) => (current > index + 1 ? current - 1 : Math.min(current, next.length)));
    setPageRotations(nextRotations);
    setDirty(true);
    announce('Page removed from the export copy.');
  }

  function duplicatePageAt(index: number) {
    const pageNumber = pageOrder[index];
    if (!pageNumber) return;
    const insertAt = index + 1;
    const next = [...pageOrder];
    next.splice(insertAt, 0, pageNumber);
    const nextRotations = [...pageRotations];
    nextRotations.splice(insertAt, 0, pageRotations[index] ?? 0);
    setPageOrder(next);
    setPageRotations(nextRotations);
    setPage(insertAt + 1);
    setDirty(true);
    announce('Page duplicated.');
  }

  function rotatePageAt(index: number) {
    setPageRotations((previous) =>
      previous.map((rotation, current) => (current === index ? (rotation + 90) % 360 : rotation)),
    );
    setDirty(true);
    announce('Page rotated. The change is applied to the exported copy.');
  }

  async function downloadCopy(currentPageOnly = false) {
    if (!session) return;
    if (
      !currentPageOnly &&
      (pageOrder.length !== session.pageCount ||
        pageOrder.some((value, index) => value !== index + 1)) &&
      !window.confirm(
        'Page changes can affect interactive forms and signatures. Export this edited copy anyway? Your original file will stay unchanged.',
      )
    )
      return;
    setLoading(true);
    setError('');
    try {
      const output = await exportPdf(
        session.bytes,
        pageOrder,
        marks,
        pageRotations,
        currentPageOnly ? page : undefined,
      );
      const name =
        fileBaseName(session.fileName) +
        (currentPageOnly ? '-page-' + page + '.pdf' : '-edited.pdf');
      savePdf(output, name);
      announce(
        currentPageOnly
          ? 'Current page downloaded as a separate PDF.'
          : 'Edited copy downloaded. The original PDF was kept unchanged.',
      );
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Could not export this PDF.';
      setError(
        message.toLowerCase().includes('encrypted')
          ? 'This PDF can be viewed with its password, but this editor cannot export encrypted files. Save an unlocked copy first.'
          : message,
      );
    } finally {
      setLoading(false);
    }
  }

  function setCustomZoom(value: number) {
    setZoom(Math.max(50, Math.min(250, value)));
    setZoomMode('custom');
  }

  function handleDrop(event: ReactDragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);
    const files = event.dataTransfer.files;
    if (files.length) void handleOpenFiles(files);
  }

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        (event.target instanceof Element &&
          event.target.closest('input,textarea,select,[contenteditable]'))
      )
        return;
      if (event.key === 'Escape' && pageMenu) {
        setPageMenu(null);
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setSearchOpen(true);
        setTimeout(() => document.getElementById('pdf-find-input')?.focus(), 0);
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redoMark();
        else undoMark();
      } else if (
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        event.key !== 'PageDown' &&
        event.key !== 'PageUp'
      ) {
        const shortcutTool: Record<string, PdfTool> = {
          v: 'Select',
          h: 'Highlight',
          d: 'Draw',
          n: 'Note',
          e: 'Eraser',
        };
        const shortcut = shortcutTool[event.key.toLowerCase()];
        if (shortcut && pdfDocument) {
          event.preventDefault();
          chooseTool(shortcut);
        }
      } else if (event.key === 'PageDown' || event.key === 'PageUp') {
        const stage = readerStage.current;
        const stageHasFocus =
          !!stage && (event.target === stage || stage.contains(event.target as Node));
        const canScroll =
          !!stage &&
          (event.key === 'PageDown'
            ? stage.scrollTop + stage.clientHeight < stage.scrollHeight - 2
            : stage.scrollTop > 2);
        if (stageHasFocus && canScroll) return;
        event.preventDefault();
        setPage((value) =>
          event.key === 'PageDown' ? Math.min(pageOrder.length, value + 1) : Math.max(1, value - 1),
        );
      }
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [pageOrder.length, marks, pdfDocument, announce, pageMenu]);

  const noteList = marks.filter((mark) => mark.page === sourcePage);
  const canUndo = markHistory.current.past.length > 0;
  const canRedo = markHistory.current.future.length > 0;

  return (
    <main
      className={'pdf-studio' + (!navSidebarOpen ? ' is-nav-collapsed' : '')}
      onDrop={handleDrop}
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDragOver(false);
      }}
    >
      <input
        ref={fileInput}
        className="pdf-file-input"
        type="file"
        accept="application/pdf,.pdf"
        multiple
        onChange={(event) => {
          if (event.currentTarget.files) void handleOpenFiles(event.currentTarget.files);
          event.currentTarget.value = '';
        }}
        aria-label="Open PDF files"
      />
      <input
        ref={folderInput}
        className="pdf-file-input"
        type="file"
        accept="application/pdf,.pdf"
        multiple
        onChange={(event) => {
          if (event.currentTarget.files) void handleOpenFolder(event.currentTarget.files);
          event.currentTarget.value = '';
        }}
        aria-label="Open a folder of PDFs"
      />
      <input
        ref={mergeInput}
        className="pdf-file-input"
        type="file"
        accept="application/pdf,.pdf"
        multiple
        onChange={(event) => {
          if (event.currentTarget.files) void mergeIntoCurrent(event.currentTarget.files);
          event.currentTarget.value = '';
        }}
        aria-label="Choose PDFs to merge"
      />
      <aside
        className={'pdf-sidebar' + (!navSidebarOpen ? ' is-collapsed' : '')}
        aria-label="PDF Studio navigation"
      >
        <div className="pdf-sidebar-brand-row">
          <a className="pdf-brand" href="./index.html" title="DayNest home">
            <span className="pdf-brand-mark" aria-hidden="true">
              d
            </span>
            <span>daynest</span>
          </a>
          <button
            className="pdf-sidebar-collapse"
            type="button"
            aria-label={navSidebarOpen ? 'Collapse navigation panel' : 'Expand navigation panel'}
            title={navSidebarOpen ? 'Collapse navigation panel' : 'Expand navigation panel'}
            aria-expanded={navSidebarOpen}
            onClick={() => setNavSidebarOpen((value) => !value)}
          >
            <Icon name={navSidebarOpen ? 'left' : 'right'} />
          </button>
        </div>
        <div className="pdf-sidebar-section">
          <p className="pdf-eyebrow">YOUR SPACE</p>
          <a
            className="pdf-nav-link"
            href="./index.html"
            title="Back to workspace"
            aria-label="Back to workspace"
          >
            <Icon name="left" />
            <span>Back to workspace</span>
          </a>
          <button
            className="pdf-nav-link is-current"
            type="button"
            aria-current="page"
            title="PDF Studio"
            aria-label="PDF Studio"
          >
            <Icon name="notes" />
            <span>PDF Studio</span>
          </button>
          <div className="pdf-file-actions">
            <button
              type="button"
              className="pdf-file-action"
              onClick={openFilePicker}
              title="Open a PDF"
            >
              <Icon name="upload" />
              <span>Open PDF</span>
            </button>
            <button
              type="button"
              className="pdf-file-action"
              onClick={openFolderPicker}
              title="Open a folder of PDFs"
            >
              <PdfFolderIcon />
              <span>Open folder</span>
            </button>
          </div>
        </div>
        <div className="pdf-sidebar-section pdf-recent-section">
          {session && (
            <div className="pdf-current-file-info">
              <p className="pdf-eyebrow">OPEN IN THIS TAB</p>
              <strong title={session.fileName}>{session.fileName}</strong>
              <span>
                {pageOrder.length} pages · {formatSize(session.fileSize)}
              </span>
              {session.title !== 'Not provided' && <small>Title · {session.title}</small>}
              {session.author !== 'Not provided' && <small>Author · {session.author}</small>}
            </div>
          )}
          {folderInfo && (
            <div className="pdf-folder-info">
              <PdfFolderIcon />
              <span>
                <strong title={folderInfo.name}>{folderInfo.name}</strong>
                <small>
                  {folderInfo.pdfCount} PDF{folderInfo.pdfCount === 1 ? '' : 's'} found
                </small>
              </span>
            </div>
          )}
          {browserTabsApi() && (
            <section className="pdf-open-tabs-section" aria-label="PDFs open in other browser tabs">
              <div className="pdf-open-tabs-heading">
                <p className="pdf-eyebrow">OPEN IN OTHER TABS</p>
                <button
                  className="pdf-open-tabs-refresh"
                  type="button"
                  aria-label="Find open PDF tabs"
                  title="Find or refresh open PDF tabs"
                  disabled={checkingPdfTabs}
                  onClick={() => void scanOpenPdfTabs(true)}
                >
                  <Icon name="search" />
                </button>
              </div>
              {checkingPdfTabs && openPdfTabs.length === 0 && (
                <p className="pdf-open-tabs-empty" role="status">
                  Checking browser tabs…
                </p>
              )}
              {!checkingPdfTabs && openPdfTabs.length === 0 && (
                <button
                  type="button"
                  className="pdf-find-open-tabs"
                  onClick={() => void scanOpenPdfTabs(true)}
                >
                  <Icon name="search" />
                  <span>{hasPdfTabPermission ? 'Check open PDFs' : 'Find open PDFs'}</span>
                  <Icon name="right" />
                </button>
              )}
              {openPdfTabs.length > 0 && (
                <div className="pdf-open-tabs-list">
                  {openPdfTabs.slice(0, 4).map((tab) => (
                    <div className="pdf-open-tab" key={tab.id}>
                      <span className="pdf-file-badge" aria-hidden="true">
                        <Icon name="notes" />
                      </span>
                      <span className="pdf-open-tab-copy">
                        <strong title={tab.title || tab.url}>
                          {tab.title?.trim() ||
                            tab.url?.split(/[/?#]/).filter(Boolean).at(-1) ||
                            'PDF document'}
                        </strong>
                        <small>{browserPdfTabLocation(tab)}</small>
                      </span>
                      <button
                        type="button"
                        className="pdf-open-tab-switch"
                        title={'Switch to ' + (tab.title || 'this PDF tab')}
                        aria-label={'Switch to ' + (tab.title || 'PDF tab')}
                        onClick={() => void switchToPdfTab(tab)}
                      >
                        <Icon name="external" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {pdfTabMessage && openPdfTabs.length === 0 && (
                <p className="pdf-open-tabs-hint" role="status">
                  {pdfTabMessage}
                </p>
              )}
              {!hasPdfTabPermission &&
                !openPdfTabs.length &&
                !checkingPdfTabs &&
                !pdfTabMessage && (
                  <p className="pdf-open-tabs-hint">
                    Browser access is requested only when you choose Find.
                  </p>
                )}
            </section>
          )}
          <p className="pdf-eyebrow pdf-recents-label">RECENTS</p>
          {recentFiles.length ? (
            <div className="pdf-recents-list">
              {recentFiles.slice(0, 5).map((file) => (
                <div className="pdf-recent-item" key={file.id}>
                  <button
                    className="pdf-recent-file"
                    type="button"
                    title={'Open ' + file.name}
                    onClick={() => void openRecentFile(file.id)}
                  >
                    <span className="pdf-file-badge" aria-hidden="true">
                      <Icon name="notes" />
                    </span>
                    <span className="pdf-recent-label">
                      <strong>{file.name}</strong>
                      <small>
                        {file.pageCount ? `${file.pageCount} pages · ` : ''}
                        {formatSize(file.size)}
                      </small>
                    </span>
                  </button>
                  <button
                    className="pdf-recent-remove"
                    type="button"
                    aria-label={'Remove ' + file.name + ' from recents'}
                    title="Remove from recents"
                    onClick={() => void forgetRecentFile(file.id)}
                  >
                    <Icon name="close" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="pdf-empty-recent">No recent PDFs yet.</p>
          )}
        </div>
        <div className="pdf-sidebar-footer">
          <span className="pdf-sunflower" aria-hidden="true">
            ✿
          </span>
          <span>A little room to focus.</span>
        </div>
      </aside>

      <section className="pdf-main">
        <header className="pdf-topbar">
          <div className="pdf-document-heading">
            <div className="pdf-mobile-brand">
              <a href="./index.html" aria-label="Back to DayNest">
                <Icon name="left" />
              </a>
            </div>
            <div className="pdf-document-title">
              <p className="pdf-eyebrow">PDF STUDIO</p>
              <h1 title={session?.fileName ?? 'A calm place for your PDFs'}>
                {session?.fileName ?? 'A calm place for your PDFs'}
              </h1>
            </div>
            {session && (
              <span
                className="pdf-private-badge"
                title="Files stay on this device. The original PDF is never modified."
              >
                <Icon name="lock" /> Local · Original safe
              </span>
            )}
            {session && dirty && (
              <span className="pdf-unsaved is-dirty">
                <i aria-hidden="true" /> Unsaved edits
              </span>
            )}
          </div>
          <div className="pdf-top-actions">
            <button
              className="pdf-action-button pdf-search-trigger"
              type="button"
              disabled={!pdfDocument}
              aria-expanded={searchOpen}
              onClick={() => {
                setSearchOpen((value) => !value);
                if (!searchOpen)
                  setTimeout(() => document.getElementById('pdf-find-input')?.focus(), 0);
              }}
            >
              <Icon name="search" />
              <span>Find</span>
            </button>
            <button
              className="pdf-action-button pdf-merge-button"
              type="button"
              aria-label="Merge PDFs"
              title="Merge PDFs"
              onClick={() => mergeInput.current?.click()}
            >
              <Icon name="plus" />
              <span>Merge</span>
            </button>
            <button
              className="pdf-action-button pdf-open-button"
              type="button"
              aria-label="Open PDF"
              title="Open PDF"
              onClick={openFilePicker}
            >
              <Icon name="upload" />
              <span>Open</span>
            </button>
            {session && (
              <button
                className="pdf-action-button pdf-close-button"
                type="button"
                aria-label="Close file"
                title="Close file"
                onClick={closeDocument}
              >
                <Icon name="close" />
                <span>Close file</span>
              </button>
            )}
            <button
              className="pdf-export-button"
              type="button"
              aria-label="Export edited PDF copy"
              title="Export copy"
              disabled={!session || loading}
              onClick={() => void downloadCopy()}
            >
              <Icon name="download" />
              <span>Export</span>
            </button>
          </div>
          <div className="pdf-toolbar" role="toolbar" aria-label="Document controls">
            <button
              className={
                'pdf-icon-button pdf-panel-toggle' + (leftPanelOpen ? '' : ' is-collapsed')
              }
              type="button"
              aria-label={leftPanelOpen ? 'Collapse pages panel' : 'Expand pages panel'}
              title={leftPanelOpen ? 'Collapse pages panel' : 'Show pages panel'}
              aria-expanded={leftPanelOpen}
              onClick={() => setLeftPanelOpen((value) => !value)}
            >
              <Icon name={leftPanelOpen ? 'left' : 'right'} />
            </button>
            <div className="pdf-mode-segment" role="group" aria-label="Reading mode">
              <button
                className={'pdf-tool-button' + (tool === 'Read' ? ' is-active' : '')}
                type="button"
                disabled={!pdfDocument}
                aria-pressed={tool === 'Read'}
                title="Read / Pan · drag to scroll"
                onClick={() => setTool('Read')}
              >
                <PdfToolIcon tool="Read" />
                <span>Read / Pan</span>
              </button>
              <button
                className={'pdf-tool-button' + (tool === 'Select' ? ' is-active' : '')}
                type="button"
                disabled={!pdfDocument}
                aria-pressed={tool === 'Select'}
                title="Select text (V)"
                onClick={() => setTool('Select')}
              >
                <PdfToolIcon tool="Select" />
                <span>Select</span>
                <kbd>V</kbd>
              </button>
            </div>
            <span className="pdf-toolbar-separator" aria-hidden="true" />
            <div className="pdf-tool-group" aria-label="Markup tools">
              {toolNames.map((name) => (
                <button
                  key={name}
                  className={'pdf-tool-button' + (tool === name ? ' is-active' : '')}
                  type="button"
                  disabled={!pdfDocument}
                  aria-pressed={tool === name}
                  title={`${name} (${toolShortcut[name]})`}
                  onClick={() => chooseTool(name)}
                >
                  <PdfToolIcon tool={name} />
                  <span>{name}</span>
                  <kbd>{toolShortcut[name]}</kbd>
                </button>
              ))}
            </div>
            <div className="pdf-history-controls" aria-label="Markup history">
              <button
                className="pdf-icon-button pdf-history-button"
                type="button"
                disabled={!canUndo}
                title="Undo (Ctrl/Cmd+Z)"
                aria-label="Undo"
                onClick={undoMark}
              >
                <Icon name="undo" />
              </button>
              <button
                className="pdf-icon-button pdf-history-button"
                type="button"
                disabled={!canRedo}
                title="Redo (Ctrl/Cmd+Shift+Z)"
                aria-label="Redo"
                onClick={redoMark}
              >
                <Icon name="redo" />
              </button>
            </div>
            <span className="pdf-toolbar-separator" aria-hidden="true" />
            <div className="pdf-page-control">
              <button
                className="pdf-icon-button"
                type="button"
                aria-label="Previous page"
                disabled={!session || page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                <Icon name="left" />
              </button>
              <label>
                <span className="sr-only">Current page</span>
                <input
                  type="number"
                  min={1}
                  max={pageOrder.length || 1}
                  value={session ? page : ''}
                  disabled={!session}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (Number.isInteger(value) && value > 0 && value <= pageOrder.length)
                      setPage(value);
                  }}
                />
              </label>
              <span className="pdf-page-total">of {pageOrder.length || 0}</span>
              <button
                className="pdf-icon-button"
                type="button"
                aria-label="Next page"
                disabled={!session || page >= pageOrder.length}
                onClick={() => setPage((value) => Math.min(pageOrder.length, value + 1))}
              >
                <Icon name="right" />
              </button>
            </div>
            <span className="pdf-toolbar-separator pdf-zoom-separator" aria-hidden="true" />
            <div className="pdf-zoom-control" aria-label="Zoom controls">
              <button
                className="pdf-icon-button"
                type="button"
                aria-label="Zoom out"
                disabled={!session || visibleZoom <= 50}
                onClick={() => setCustomZoom(visibleZoom - 10)}
              >
                −
              </button>
              <span>{session ? visibleZoom : 100}%</span>
              <button
                className="pdf-icon-button"
                type="button"
                aria-label="Zoom in"
                disabled={!session || visibleZoom >= 250}
                onClick={() => setCustomZoom(visibleZoom + 10)}
              >
                ＋
              </button>
            </div>
            <button
              className={'pdf-fit-button' + (zoomMode === 'page' ? ' is-active' : '')}
              type="button"
              aria-pressed={zoomMode === 'page'}
              disabled={!session}
              onClick={() => setZoomMode((value) => (value === 'page' ? 'width' : 'page'))}
            >
              {zoomMode === 'page' ? 'Fit width' : 'Fit page'}
            </button>
            <button
              className={
                'pdf-icon-button pdf-panel-toggle pdf-desktop-workspace-toggle' +
                (rightPanelOpen ? '' : ' is-collapsed')
              }
              type="button"
              aria-label={rightPanelOpen ? 'Collapse workspace panel' : 'Expand workspace panel'}
              title={rightPanelOpen ? 'Collapse workspace panel' : 'Show workspace panel'}
              aria-expanded={rightPanelOpen}
              onClick={() => setRightPanelOpen((value) => !value)}
            >
              <Icon name={rightPanelOpen ? 'right' : 'left'} />
            </button>
            <button
              className="pdf-icon-button pdf-mobile-tools-toggle"
              type="button"
              aria-label={mobilePanelOpen ? 'Close Properties' : 'Open Properties'}
              title={mobilePanelOpen ? 'Close Properties' : 'Open Properties'}
              aria-controls="pdf-tools-panel"
              aria-expanded={mobilePanelOpen}
              onClick={() => setMobilePanelOpen((value) => !value)}
            >
              <Icon name="settings" />
            </button>
          </div>
        </header>
        {searchOpen && (
          <form className="pdf-search-bar" onSubmit={(event) => void runSearch(event)}>
            <Icon name="search" />
            <input
              id="pdf-find-input"
              aria-label="Find text in PDF"
              placeholder="Find text in this PDF…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              disabled={!pdfDocument || searching}
            />
            <button
              className="pdf-find-submit"
              type="submit"
              disabled={!pdfDocument || searching || !query.trim()}
            >
              {searching ? 'Searching…' : 'Find'}
            </button>
            {searchResults.length > 0 && (
              <div className="pdf-search-result-nav">
                <span>
                  {searchIndex + 1} of {searchResults.length} matching pages
                </span>
                <button
                  className="pdf-icon-button"
                  type="button"
                  aria-label="Previous search result"
                  onClick={() => moveSearchResult(-1)}
                >
                  <Icon name="left" />
                </button>
                <button
                  className="pdf-icon-button"
                  type="button"
                  aria-label="Next search result"
                  onClick={() => moveSearchResult(1)}
                >
                  <Icon name="right" />
                </button>
              </div>
            )}
            {searchTerm && searchResults.length === 0 && !searching && (
              <span aria-live="polite">No matching pages</span>
            )}
            <button
              className="pdf-icon-button"
              aria-label="Close search"
              type="button"
              onClick={() => {
                setSearchOpen(false);
                setQuery('');
                setSearchTerm('');
                setSearchResults([]);
              }}
            >
              <Icon name="close" />
            </button>
          </form>
        )}

        <div
          className={
            'pdf-workspace' +
            (!leftPanelOpen ? ' is-left-collapsed' : '') +
            (!rightPanelOpen ? ' is-right-collapsed' : '')
          }
        >
          <aside className="pdf-pages-rail" aria-label="PDF pages">
            <div className="pdf-panel-heading">
              <div>
                <p className="pdf-eyebrow">DOCUMENT</p>
                <h2>Pages</h2>
              </div>
              <button
                className="pdf-icon-button"
                type="button"
                aria-label="Merge more PDFs"
                title="Merge more PDFs"
                onClick={() => mergeInput.current?.click()}
              >
                <Icon name="plus" />
              </button>
            </div>
            {!session && <div className="pdf-rail-empty">Page thumbnails will appear here.</div>}
            <div className="pdf-thumbnail-list">
              {pdfDocument &&
                pageOrder.map((pageNumber, index) => (
                  <div
                    ref={(node) => {
                      if (node) thumbnailRefs.current.set(index, node);
                      else thumbnailRefs.current.delete(index);
                    }}
                    key={`${pageNumber}-${index}`}
                    className={'pdf-thumbnail-item' + (page === index + 1 ? ' is-selected' : '')}
                    draggable
                    onContextMenu={(event) => {
                      event.preventDefault();
                      showPageMenu(index, event.clientX, event.clientY);
                    }}
                    onDragStart={(event) => {
                      event.dataTransfer.setData('text/plain', String(index));
                      event.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const from = Number(event.dataTransfer.getData('text/plain'));
                      if (Number.isInteger(from)) movePage(from, index);
                    }}
                  >
                    <button
                      className="pdf-page-thumb"
                      type="button"
                      aria-current={page === index + 1 ? 'page' : undefined}
                      aria-label={'Go to page ' + (index + 1)}
                      onClick={() => setPage(index + 1)}
                    >
                      <PageThumbnail
                        document={pdfDocument}
                        pageNumber={pageNumber}
                        viewRotation={pageRotations[index] ?? 0}
                      />
                      <span className="pdf-thumbnail-caption">Page {index + 1}</span>
                    </button>
                    <button
                      className="pdf-thumbnail-menu-trigger"
                      type="button"
                      aria-label={'Page ' + (index + 1) + ' options'}
                      aria-haspopup="menu"
                      title="Page options"
                      onClick={(event) => {
                        event.stopPropagation();
                        showPageMenu(
                          index,
                          event.currentTarget.getBoundingClientRect().right,
                          event.currentTarget.getBoundingClientRect().bottom,
                        );
                      }}
                    >
                      <Icon name="more" />
                    </button>
                  </div>
                ))}
            </div>
            {session && <p className="pdf-drag-hint">Drag pages to change their order.</p>}
          </aside>

          <section
            className={'pdf-reader' + (dragOver ? ' is-drop-target' : '')}
            aria-label="PDF reader"
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDrop={handleDrop}
          >
            <div
              className={'pdf-reader-stage' + (tool === 'Read' ? ' is-read-mode' : '')}
              ref={readerStage}
              tabIndex={0}
              aria-label="Scrollable PDF page area"
              title={
                tool === 'Read'
                  ? 'Scroll through the page; keep scrolling at an edge to turn pages. Drag to pan.'
                  : 'Scroll here to view the full page; keep scrolling at an edge to turn pages.'
              }
              onWheel={handleReaderWheel}
              onPointerDown={startPan}
              onPointerMove={movePan}
              onPointerUp={stopPan}
              onPointerCancel={stopPan}
            >
              {!session && !loading && (
                <div className="pdf-welcome">
                  <span className="pdf-welcome-icon">
                    <Icon name="notes" />
                  </span>
                  <p className="pdf-eyebrow">DAYNEST PDF STUDIO</p>
                  <h2>A quieter place to work with PDFs.</h2>
                  <p>Read, search, mark up, arrange pages and export a copy.</p>
                  <div className="pdf-welcome-actions">
                    <button className="pdf-export-button" type="button" onClick={openFilePicker}>
                      <Icon name="upload" /> Open a PDF
                    </button>
                    <button className="pdf-welcome-folder" type="button" onClick={openFolderPicker}>
                      <PdfFolderIcon /> Open folder
                    </button>
                  </div>
                  <span className="pdf-drop-copy">or drop a PDF anywhere in this window</span>
                  {folderInfo && (
                    <p className="pdf-welcome-folder-info" title={folderInfo.name}>
                      <PdfFolderIcon /> {folderInfo.name} · {folderInfo.pdfCount} PDF
                      {folderInfo.pdfCount === 1 ? '' : 's'}
                    </p>
                  )}
                  {recentFiles.length > 0 && (
                    <section className="pdf-welcome-recents" aria-label="Recent PDFs">
                      <div className="pdf-welcome-recents-heading">
                        <Icon name="history" />
                        <strong>Recent files</strong>
                        <span>{recentFiles.length}</span>
                      </div>
                      <div>
                        {recentFiles.slice(0, 3).map((file) => (
                          <button
                            key={file.id}
                            type="button"
                            className="pdf-welcome-recent"
                            title={'Open ' + file.name}
                            onClick={() => void openRecentFile(file.id)}
                          >
                            <Icon name="notes" />
                            <span>
                              <strong>{file.name}</strong>
                              <small>
                                {file.pageCount ? `${file.pageCount} pages · ` : ''}
                                {formatSize(file.size)}
                                {file.folder ? ' · ' + file.folder : ''}
                              </small>
                            </span>
                            <Icon name="right" />
                          </button>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}
              {loading && !pdfDocument && (
                <div className="pdf-load-state">
                  <span className="pdf-loader" />
                  <strong>{notice || 'Opening your PDF…'}</strong>
                  {loadingProgress > 0 && (
                    <div
                      className="pdf-load-progress"
                      role="progressbar"
                      aria-label="Loading PDF"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={loadingProgress}
                    >
                      <span style={{ width: loadingProgress + '%' }} />
                    </div>
                  )}
                </div>
              )}
              {session && pdfDocument && activePage && (
                <PdfPageSurface
                  page={activePage}
                  pageNumber={sourcePage}
                  scale={renderScale}
                  viewRotation={pageRotation}
                  tool={tool}
                  color={
                    tool === 'Highlight' ? highlightColor : tool === 'Note' ? noteColor : inkColor
                  }
                  highlightOpacity={highlightOpacity}
                  strokeWidth={strokeWidth}
                  selectedMarkId={selectedMarkId}
                  marks={marks}
                  searchTerm={searchTerm}
                  onAddMark={addMark}
                  onEraseMark={removeMark}
                  onPlaceNote={(point) => {
                    setPendingNote(point);
                    setNoteText('');
                    setMobilePanelOpen(true);
                    announce('Write your note in the Properties panel, then add it to the page.');
                  }}
                />
              )}
              {session && !activePage && !loading && (
                <div className="pdf-load-state">
                  <span className="pdf-loader" />
                  <strong>Rendering page {page}…</strong>
                </div>
              )}
              {loading && pdfDocument && (
                <div className="pdf-loading-ribbon" role="status">
                  <span className="pdf-loader-small" /> Opening another PDF…
                </div>
              )}
              {dragOver && (
                <div className="pdf-drop-overlay">
                  <Icon name="upload" />
                  <strong>Drop PDF to open it</strong>
                  <span>Choose one file to read or several to merge.</span>
                </div>
              )}
            </div>
            <footer
              className="pdf-reader-status"
              role="status"
              title={error || (session ? 'Local · Original safe' : notice)}
            >
              <span
                className="pdf-reader-status-copy"
                title={error || (session ? 'Local · Original safe' : notice)}
              >
                {error || (session ? 'Local · Original safe' : 'Open a PDF to begin.')}
              </span>
              <span className="pdf-reader-status-position">
                {session
                  ? 'Page ' + page + ' of ' + pageOrder.length + ' · ' + visibleZoom + '%'
                  : ''}
              </span>
            </footer>
          </section>

          {mobilePanelOpen && (
            <button
              className="pdf-panel-backdrop"
              type="button"
              aria-label="Close PDF tools"
              onClick={() => setMobilePanelOpen(false)}
            />
          )}
          <aside
            id="pdf-tools-panel"
            className={
              'pdf-inspector' +
              (!rightPanelOpen ? ' is-collapsed' : '') +
              (mobilePanelOpen ? ' is-mobile-open' : '')
            }
            aria-label="PDF Properties"
          >
            <div className="pdf-inspector-heading">
              <div>
                <p className="pdf-eyebrow">WORKSPACE</p>
                <h2>Properties</h2>
              </div>
              <div className="pdf-inspector-heading-actions">
                <button
                  className="pdf-icon-button pdf-property-collapse"
                  type="button"
                  aria-label={
                    rightPanelOpen ? 'Collapse Properties panel' : 'Expand Properties panel'
                  }
                  title={rightPanelOpen ? 'Collapse panel' : 'Expand panel'}
                  aria-expanded={rightPanelOpen}
                  onClick={() => setRightPanelOpen((value) => !value)}
                >
                  <Icon name={rightPanelOpen ? 'right' : 'left'} />
                </button>
                <button
                  className="pdf-icon-button pdf-mobile-panel-close"
                  type="button"
                  aria-label="Close Properties"
                  onClick={() => setMobilePanelOpen(false)}
                >
                  <Icon name="close" />
                </button>
              </div>
            </div>
            <div className="pdf-inspector-content">
              {!session && (
                <div className="pdf-properties-empty">
                  <Icon name="notes" />
                  <strong>Properties</strong>
                  <span>Open a PDF to adjust markup and see items on the current page.</span>
                </div>
              )}
              {session && (
                <>
                  {tool === 'Highlight' && (
                    <section className="pdf-property-section">
                      <p className="pdf-field-label">HIGHLIGHT</p>
                      <span className="pdf-property-label">Colour</span>
                      <ColorPalette
                        value={highlightColor}
                        onChange={setHighlightColor}
                        label="Highlight colour"
                      />
                      <label className="pdf-range-row">
                        <span>Opacity</span>
                        <output>{Math.round(highlightOpacity * 100)}%</output>
                        <input
                          type="range"
                          min="10"
                          max="100"
                          step="5"
                          value={Math.round(highlightOpacity * 100)}
                          onChange={(event) =>
                            setHighlightOpacity(Number(event.target.value) / 100)
                          }
                        />
                      </label>
                    </section>
                  )}
                  {(tool === 'Draw' || tool === 'Eraser') && (
                    <section className="pdf-property-section">
                      <p className="pdf-field-label">INK</p>
                      <span className="pdf-property-label">Colour</span>
                      <ColorPalette value={inkColor} onChange={setInkColor} label="Ink colour" />
                      <label className="pdf-range-row">
                        <span>Stroke width</span>
                        <output>{strokeWidth}px</output>
                        <input
                          type="range"
                          min="1"
                          max="12"
                          step="1"
                          value={strokeWidth}
                          onChange={(event) => setStrokeWidth(Number(event.target.value))}
                        />
                      </label>
                      <button
                        className={'pdf-eraser-toggle' + (tool === 'Eraser' ? ' is-active' : '')}
                        type="button"
                        aria-pressed={tool === 'Eraser'}
                        onClick={() => chooseTool(tool === 'Eraser' ? 'Draw' : 'Eraser')}
                      >
                        <PdfToolIcon tool="Eraser" />
                        <span>{tool === 'Eraser' ? 'Eraser on' : 'Use eraser'}</span>
                        <kbd>E</kbd>
                      </button>
                    </section>
                  )}
                  {tool === 'Note' && (
                    <section className="pdf-property-section">
                      <p className="pdf-field-label">NOTE</p>
                      <span className="pdf-property-label">Colour</span>
                      <ColorPalette value={noteColor} onChange={setNoteColor} label="Note colour" />
                      {noteList.filter((mark) => mark.type === 'note').length > 0 && (
                        <>
                          <p className="pdf-property-label pdf-notes-label">Notes on this page</p>
                          <div className="pdf-note-list">
                            {noteList
                              .filter((mark) => mark.type === 'note')
                              .map((mark) => (
                                <button
                                  type="button"
                                  key={mark.id}
                                  onClick={() => jumpToMark(mark)}
                                >
                                  <Icon name="sticky" />
                                  <span>{mark.text}</span>
                                </button>
                              ))}
                          </div>
                        </>
                      )}
                    </section>
                  )}
                  {(tool === 'Read' || tool === 'Select') && (
                    <p className="pdf-mode-hint">
                      {tool === 'Read'
                        ? 'Read / Pan · drag the page to scroll.'
                        : 'Select · drag across text to select and copy it.'}
                    </p>
                  )}
                  {pendingNote && (
                    <form
                      className="pdf-note-editor"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const text = noteText.trim();
                        if (!text) {
                          setError('Write a note before adding it.');
                          return;
                        }
                        addMark({
                          id: crypto.randomUUID(),
                          page: sourcePage,
                          type: 'note',
                          color: noteColor,
                          point: pendingNote,
                          text,
                        });
                        setError('');
                      }}
                    >
                      <label htmlFor="pdf-note-text">NOTE TEXT</label>
                      <textarea
                        id="pdf-note-text"
                        rows={4}
                        maxLength={500}
                        placeholder="Write a short note…"
                        value={noteText}
                        onChange={(event) => setNoteText(event.target.value)}
                      />
                      <div>
                        <button
                          type="button"
                          className="pdf-small-button"
                          onClick={() => {
                            setPendingNote(null);
                            setNoteText('');
                          }}
                        >
                          Cancel
                        </button>
                        <button type="submit" className="pdf-small-primary">
                          Add note
                        </button>
                      </div>
                    </form>
                  )}
                  <div className="pdf-inspector-divider" />
                  <p className="pdf-field-label">
                    ON THIS PAGE <span>{noteList.length}</span>
                  </p>
                  {noteList.length === 0 && (
                    <p className="pdf-panel-copy">
                      No markup on page {page} yet. Choose a tool above to add one.
                    </p>
                  )}
                  <div className="pdf-mark-list">
                    {noteList.map((mark) => (
                      <div
                        className={
                          'pdf-mark-row' + (selectedMarkId === mark.id ? ' is-selected' : '')
                        }
                        key={mark.id}
                      >
                        <button
                          className="pdf-mark-jump"
                          type="button"
                          onClick={() => jumpToMark(mark)}
                          title="Jump to markup"
                        >
                          <span
                            className={'pdf-mark-kind pdf-mark-kind-' + mark.type}
                            style={{ '--mark-color': mark.color } as CSSProperties}
                          >
                            {mark.type === 'note' ? (
                              <Icon name="sticky" />
                            ) : mark.type === 'ink' ? (
                              <Icon name="pencil" />
                            ) : (
                              <PdfToolIcon tool="Highlight" />
                            )}
                          </span>
                          <span>
                            <strong>
                              {mark.type === 'note'
                                ? mark.text
                                : mark.type === 'ink'
                                  ? 'Freehand mark'
                                  : 'Highlight'}
                            </strong>
                            <small>Page {page}</small>
                          </span>
                        </button>
                        <button
                          type="button"
                          aria-label="Delete markup"
                          title="Delete markup"
                          onClick={() => removeMark(mark.id)}
                        >
                          <Icon name="trash" />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </aside>
          {pageMenu && (
            <>
              <button
                className="pdf-page-menu-dismiss"
                type="button"
                aria-label="Close page options"
                onClick={() => setPageMenu(null)}
              />
              <div
                className="pdf-page-context-menu"
                role="menu"
                aria-label={'Page ' + (pageMenu.index + 1) + ' options'}
                style={{ left: pageMenu.x, top: pageMenu.y }}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    rotatePageAt(pageMenu.index);
                    setPageMenu(null);
                  }}
                >
                  <Icon name="reset" />
                  <span>Rotate</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    duplicatePageAt(pageMenu.index);
                    setPageMenu(null);
                  }}
                >
                  <Icon name="plus" />
                  <span>Duplicate</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={pageMenu.index === 0}
                  onClick={() => {
                    movePage(pageMenu.index, pageMenu.index - 1);
                    setPageMenu(null);
                  }}
                >
                  <Icon name="up" />
                  <span>Move up</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={pageMenu.index === pageOrder.length - 1}
                  onClick={() => {
                    movePage(pageMenu.index, pageMenu.index + 1);
                    setPageMenu(null);
                  }}
                >
                  <Icon name="down" />
                  <span>Move down</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="is-danger"
                  disabled={pageOrder.length <= 1}
                  onClick={() => {
                    deletePageAt(pageMenu.index);
                    setPageMenu(null);
                  }}
                >
                  <Icon name="trash" />
                  <span>Delete</span>
                </button>
              </div>
            </>
          )}
        </div>
        <p className="sr-only" role="status" aria-live="polite">
          {error || notice}
        </p>
      </section>

      {passwordPrompt && (
        <div className="pdf-modal-backdrop">
          <form
            className="pdf-password-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pdf-password-title"
            onSubmit={submitPassword}
          >
            <span className="pdf-password-icon">
              <Icon name="lock" />
            </span>
            <h2 id="pdf-password-title">This PDF is protected</h2>
            <p>
              Enter the password for <strong>{passwordPrompt.fileName}</strong>. The password is
              used only to open this file in the current tab.
            </p>
            <label htmlFor="pdf-password">PDF password</label>
            <input
              ref={passwordInput}
              id="pdf-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {passwordPrompt.incorrect && (
              <p className="pdf-password-error" role="alert">
                That password was not accepted. Try again.
              </p>
            )}
            <div className="pdf-password-actions">
              <button type="button" className="pdf-small-button" onClick={cancelPassword}>
                Cancel
              </button>
              <button className="pdf-small-primary" type="submit">
                Open PDF
              </button>
            </div>
          </form>
        </div>
      )}
      {closeConfirmOpen && (
        <div className="pdf-modal-backdrop">
          <div
            className="pdf-password-dialog pdf-close-confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pdf-close-title"
          >
            <span className="pdf-password-icon">
              <Icon name="close" />
            </span>
            <h2 id="pdf-close-title">Close this file?</h2>
            <p>Close without exporting? Your markup will be lost.</p>
            <div className="pdf-password-actions">
              <button
                type="button"
                className="pdf-small-button"
                onClick={() => setCloseConfirmOpen(false)}
              >
                Cancel
              </button>
              <button type="button" className="pdf-small-primary" onClick={performCloseDocument}>
                Close anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
