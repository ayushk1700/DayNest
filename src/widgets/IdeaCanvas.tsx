import { InsightBrandBar, InsightGlyph } from './InsightChrome';
import { useDrafts } from '../state/drafts';
import { useEffect, useRef, useState } from 'react';
import type { IdeaNode, IdeaTone, Widget } from '../state/model';
import type { Action } from '../state/actions';
import { dashboardStore, useDashboard } from '../state/store';
import { DraftField } from '../ui/DraftField';
import { Icon, type Name as IconName } from '../ui/Icon';
import './ideaCanvas.css';

type Scratchpad = Extract<Widget, { type: 'scratchpad' }>;
type IdeaField = 'title' | 'body';
type PortSide = 'left' | 'right' | 'top' | 'bottom';
type ConnectionPreview = { x1: number; y1: number; x2: number; y2: number };

const moveDirections = [
  { label: 'Move up', x: 0, y: -20, symbol: 'up' },
  { label: 'Move left', x: -20, y: 0, symbol: 'left' },
  { label: 'Move right', x: 20, y: 0, symbol: 'right' },
  { label: 'Move down', x: 0, y: 20, symbol: 'down' },
];
const nodeTones: { id: IdeaTone; label: string; color: string }[] = [
  { id: 'paper', label: 'Paper', color: '#f7f8f4' },
  { id: 'sage', label: 'Sage', color: '#8da48a' },
  { id: 'sky', label: 'Sky', color: '#7da5b5' },
  { id: 'sand', label: 'Sand', color: '#c5a66f' },
  { id: 'rose', label: 'Rose', color: '#c1848c' },
  { id: 'lavender', label: 'Lavender', color: '#9b8cba' },
];
const nodeSizes = [
  { label: 'Compact', width: 176 },
  { label: 'Balanced', width: 200 },
  { label: 'Wide', width: 260 },
];

function threadPath(ax: number, ay: number, bx: number, by: number) {
  const horizontal = Math.abs(bx - ax) > Math.abs(by - ay);
  if (horizontal) {
    const mid = (ax + bx) / 2;
    return 'M' + ax + ',' + ay + ' C' + mid + ',' + ay + ' ' + mid + ',' + by + ' ' + bx + ',' + by;
  }
  const mid = (ay + by) / 2;
  return 'M' + ax + ',' + ay + ' C' + ax + ',' + mid + ' ' + bx + ',' + mid + ' ' + bx + ',' + by;
}

export function IdeaCanvas({
  widget,
  close,
  startNew,
}: {
  widget: Scratchpad;
  close: () => void;
  startNew: boolean;
}) {
  const [tool, setTool] = useState<'select' | 'pan' | 'connect'>('select');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [list, setList] = useState(false);
  const [view, setView] = useState({ x: 60, y: 60, zoom: 1 });
  const [grid, setGrid] = useState(true);
  const [source, setSource] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; field: IdeaField } | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [connectionPreview, setConnectionPreview] = useState<ConnectionPreview | null>(null);
  const [error, setError] = useState('');
  const [moving, setMoving] = useState<{ id: string; x: number; y: number } | null>(null);
  const area = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const dragClickSuppressed = useRef(false);
  const connectionClickSuppressed = useRef(false);
  const activeConnectionCleanup = useRef<(() => void) | null>(null);
  const drafts = useDrafts();
  const state = useDashboard();
  const nodes = widget.content.nodes;
  const edges = widget.content.connections;
  const chosen = nodes.find((node) => node.id === selected);
  const visible = nodes.filter((node) =>
    (node.title + ' ' + node.body).toLowerCase().includes(query.toLowerCase()),
  );

  async function send(action: Action) {
    setError('');
    try {
      await dashboardStore.dispatch(action);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save.');
      return false;
    }
  }

  async function add() {
    const id = crypto.randomUUID();
    const node: IdeaNode = {
      id,
      title: 'Untitled idea',
      body: '',
      position: {
        x: Math.max(
          -100000,
          Math.min(100000, Math.round((100 - view.x) / view.zoom) + (nodes.length % 5) * 220),
        ),
        y: Math.max(
          -100000,
          Math.min(
            100000,
            Math.round((100 - view.y) / view.zoom) + Math.floor(nodes.length / 5) * 140,
          ),
        ),
      },
    };
    if (await send({ type: 'graphNode', widgetId: widget.id, id, expected: null, value: node })) {
      setSelected(id);
      setEditing({ id, field: 'title' });
    }
  }

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      if (startNew) void add();
      else if (nodes.length) fit();
    }
  }, []);

  useEffect(() => () => activeConnectionCleanup.current?.(), []);

  async function makeConnection(from: string, to: string) {
    if (from === to) {
      setError('Choose a different idea to make a connection.');
      return false;
    }
    if (
      edges.some(
        (edge) => (edge.from === from && edge.to === to) || (edge.from === to && edge.to === from),
      )
    ) {
      setError('These ideas are already connected.');
      return false;
    }
    const id = crypto.randomUUID();
    const saved = await send({
      type: 'graphConnection',
      widgetId: widget.id,
      id,
      expected: null,
      value: { id, from, to },
    });
    if (saved) {
      setSource(null);
      setSelected(to);
    }
    return saved;
  }

  async function connect(to: string) {
    if (!source) return false;
    return makeConnection(source, to);
  }

  function fit() {
    if (!nodes.length) {
      setView({ x: 60, y: 60, zoom: 1 });
      return;
    }
    const rect = area.current?.getBoundingClientRect();
    const minX = Math.min(...nodes.map((node) => node.position.x));
    const minY = Math.min(...nodes.map((node) => node.position.y));
    const width = Math.max(...nodes.map((node) => node.position.x + (node.width ?? 200))) - minX;
    const height = Math.max(...nodes.map((node) => node.position.y + (node.height ?? 80))) - minY;
    const zoom = Math.max(
      0.0001,
      Math.min(1, ((rect?.width ?? 800) - 80) / width, ((rect?.height ?? 500) - 80) / height),
    );
    setView({ x: 40 - minX * zoom, y: 40 - minY * zoom, zoom });
  }

  function zoom(factor: number) {
    setView((current) => {
      const nextZoom = Math.max(0.0001, Math.min(2, current.zoom * factor));
      const rect = area.current?.getBoundingClientRect();
      const centerX = (rect?.width ?? 800) / 2;
      const centerY = (rect?.height ?? 500) / 2;
      return {
        x: centerX - ((centerX - current.x) * nextZoom) / current.zoom,
        y: centerY - ((centerY - current.y) * nextZoom) / current.zoom,
        zoom: nextZoom,
      };
    });
  }

  function pointOnPlane(clientX: number, clientY: number) {
    const rect = area.current?.getBoundingClientRect();
    const x = clientX - (rect?.left ?? 0);
    const y = clientY - (rect?.top ?? 0);
    return list ? { x, y } : { x: (x - view.x) / view.zoom, y: (y - view.y) / view.zoom };
  }

  function startConnection(event: React.PointerEvent<HTMLButtonElement>, node: IdeaNode) {
    if (event.button !== 0) return;
    event.stopPropagation();
    activeConnectionCleanup.current?.();

    const port = event.currentTarget.getBoundingClientRect();
    const origin = pointOnPlane(port.left + port.width / 2, port.top + port.height / 2);
    const startX = event.clientX;
    const startY = event.clientY;
    let dragged = false;

    const cleanup = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', finish);
      document.removeEventListener('pointercancel', finish);
      if (activeConnectionCleanup.current === cleanup) activeConnectionCleanup.current = null;
    };
    const move = (pointer: PointerEvent) => {
      if (!dragged && Math.hypot(pointer.clientX - startX, pointer.clientY - startY) < 4) return;
      dragged = true;
      const target = pointOnPlane(pointer.clientX, pointer.clientY);
      setConnectionPreview({ x1: origin.x, y1: origin.y, x2: target.x, y2: target.y });
    };
    const finish = (pointer: PointerEvent) => {
      cleanup();
      setConnectionPreview(null);
      if (pointer.type === 'pointercancel') return;
      if (!dragged) return;
      connectionClickSuppressed.current = true;
      const target = document
        .elementFromPoint(pointer.clientX, pointer.clientY)
        ?.closest<HTMLElement>('[data-idea-node]')?.dataset.ideaNode;
      if (target && target !== node.id) void makeConnection(node.id, target);
      else setSource(node.id);
      window.setTimeout(() => {
        connectionClickSuppressed.current = false;
      }, 0);
    };

    activeConnectionCleanup.current = cleanup;
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', finish);
    document.addEventListener('pointercancel', finish);
  }

  function handlePortClick(nodeId: string) {
    if (connectionClickSuppressed.current) {
      connectionClickSuppressed.current = false;
      return;
    }
    if (!source) setSource(nodeId);
    else if (source !== nodeId) void connect(nodeId);
  }

  function moveNode(e: React.PointerEvent<HTMLButtonElement>, node: IdeaNode) {
    if (list || tool !== 'select' || e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const element = e.currentTarget;
    let last = node.position;
    let dragged = false;
    element.setPointerCapture(e.pointerId);
    const move = (pointer: PointerEvent) => {
      if (Math.hypot(pointer.clientX - startX, pointer.clientY - startY) < 4 && !dragged) return;
      dragged = true;
      last = {
        x: Math.max(
          -100000,
          Math.min(100000, Math.round(node.position.x + (pointer.clientX - startX) / view.zoom)),
        ),
        y: Math.max(
          -100000,
          Math.min(100000, Math.round(node.position.y + (pointer.clientY - startY) / view.zoom)),
        ),
      };
      setMoving({ id: node.id, ...last });
    };
    const finish = (pointer: PointerEvent) => {
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerup', finish);
      element.removeEventListener('pointercancel', finish);
      setMoving(null);
      if (dragged && pointer.type !== 'pointercancel') {
        dragClickSuppressed.current = true;
        void send({
          type: 'graphNode',
          widgetId: widget.id,
          id: node.id,
          expected: node,
          value: { ...node, position: last },
        });
        window.setTimeout(() => {
          dragClickSuppressed.current = false;
        }, 0);
      }
    };
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', finish);
    element.addEventListener('pointercancel', finish);
  }

  function activateNode(node: IdeaNode, field: IdeaField) {
    if (dragClickSuppressed.current) {
      dragClickSuppressed.current = false;
      return;
    }
    setSelected(node.id);
    if (tool === 'connect') {
      if (source && source !== node.id) void connect(node.id);
      else setSource(node.id);
      return;
    }
    setEditing({ id: node.id, field });
  }

  function closeInlineEditor(id: string, field: IdeaField) {
    setEditing((current) => (current?.id === id && current.field === field ? null : current));
  }

  async function saveNodeField(
    node: IdeaNode,
    field: IdeaField,
    expectedText: string,
    valueText: string,
  ) {
    const expected =
      field === 'title' ? { ...node, title: expectedText } : { ...node, body: expectedText };
    const value = field === 'title' ? { ...node, title: valueText } : { ...node, body: valueText };
    await dashboardStore.dispatch({
      type: 'graphNode',
      widgetId: widget.id,
      id: node.id,
      expected,
      value,
    });
  }

  function customizeNode(node: IdeaNode, patch: Partial<Pick<IdeaNode, 'tone' | 'width'>>) {
    void send({
      type: 'graphNode',
      widgetId: widget.id,
      id: node.id,
      expected: node,
      value: { ...node, ...patch },
    });
  }

  function moveNodeBy(node: IdeaNode, dx: number, dy: number) {
    const position = {
      x: Math.max(-100000, Math.min(100000, node.position.x + dx)),
      y: Math.max(-100000, Math.min(100000, node.position.y + dy)),
    };
    void send({
      type: 'graphNode',
      widgetId: widget.id,
      id: node.id,
      expected: node,
      value: { ...node, position },
    });
  }

  async function removeConnection(edge: (typeof edges)[number]) {
    await send({
      type: 'graphConnection',
      widgetId: widget.id,
      id: edge.id,
      expected: edge,
      value: null,
    });
  }

  function deleteIdea(node: IdeaNode) {
    const incident = edges.filter((edge) => edge.from === node.id || edge.to === node.id);
    void send({
      type: 'graphNode',
      widgetId: widget.id,
      id: node.id,
      expected: node,
      value: null,
      incident,
    }).then((saved) => {
      if (saved) {
        setSelected((current) => (current === node.id ? null : current));
        setEditing((current) => (current?.id === node.id ? null : current));
        setOpenMenu(null);
        setDeleteId(null);
      }
    });
  }

  return (
    <div className="insight-page idea-page">
      <InsightBrandBar close={close} workspace />
      <header className="idea-page-heading">
        <div>
          <h1>{widget.title || 'Scratchpad'}</h1>
          <p>Let one thought lead to another.</p>
        </div>
        <div className="idea-top-actions">
          <button
            className="sage-button"
            onClick={() => void add()}
            disabled={nodes.length >= 200 || state.pending > 0}
          >
            + Idea
          </button>
          <button
            aria-pressed={tool === 'connect'}
            onClick={() => {
              setTool('connect');
              if (chosen) setSource(chosen.id);
            }}
          >
            <InsightGlyph name="link" />
            Connect
          </button>
          <button
            aria-label="Search canvas"
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen(!searchOpen)}
          >
            <InsightGlyph name="search" />
          </button>
          {searchOpen && (
            <input
              autoFocus
              aria-label="Search ideas"
              placeholder="Find an idea…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          )}
        </div>
      </header>
      <div className="idea-floating-tools" aria-label="Canvas tools">
        <button
          aria-label="Select tool"
          aria-pressed={tool === 'select'}
          onClick={() => setTool('select')}
        >
          <InsightGlyph name="cursor" />
        </button>
        <button aria-label="Pan tool" aria-pressed={tool === 'pan'} onClick={() => setTool('pan')}>
          <InsightGlyph name="hand" />
        </button>
        <button
          aria-label="Add idea"
          onClick={() => void add()}
          disabled={nodes.length >= 200 || state.pending > 0}
        >
          +
        </button>
        <button
          aria-label="Connect tool"
          aria-pressed={tool === 'connect'}
          onClick={() => {
            setTool('connect');
            if (chosen) setSource(chosen.id);
          }}
        >
          <InsightGlyph name="link" />
        </button>
        <details className="idea-more">
          <summary aria-label="Canvas options">⋯</summary>
          <div>
            <button aria-pressed={list} onClick={() => setList(!list)}>
              {list ? 'Canvas view' : 'List view'}
            </button>
            <button onClick={fit}>Fit ideas</button>
            <button aria-pressed={grid} onClick={() => setGrid(!grid)}>
              Grid
            </button>
            <button
              disabled={!state.canUndo || state.pending > 0 || drafts.length > 0}
              onClick={() =>
                void dashboardStore.travel('undo').catch((reason) => setError(reason.message))
              }
            >
              Undo
            </button>
            <button
              disabled={!state.canRedo || state.pending > 0 || drafts.length > 0}
              onClick={() =>
                void dashboardStore.travel('redo').catch((reason) => setError(reason.message))
              }
            >
              Redo
            </button>
          </div>
        </details>
      </div>
      <div className="idea-zoom-controls">
        <button onClick={() => zoom(0.8)} aria-label="Zoom out">
          −
        </button>
        <span>{Math.round(view.zoom * 10000) / 100}%</span>
        <button onClick={() => zoom(1.25)} aria-label="Zoom in">
          +
        </button>
      </div>
      <div className="idea-local-status">
        <i />
        Saved on this device.
      </div>
      {error && <p role="alert">{error} Your saved ideas were kept.</p>}
      {source && (
        <p role="status">
          Choose a destination for {nodes.find((node) => node.id === source)?.title}.{' '}
          <button onClick={() => setSource(null)}>Cancel connection</button>
        </p>
      )}
      <div className="idea-workspace">
        <div
          className={'idea-board ' + (grid ? 'idea-grid ' : '') + (list ? 'as-list' : '')}
          ref={area}
          aria-label="Idea canvas"
          onPointerDown={(event) => {
            if (event.target !== event.currentTarget) return;
            const startX = event.clientX;
            const startY = event.clientY;
            const original = view;
            const element = event.currentTarget;
            element.setPointerCapture(event.pointerId);
            const move = (pointer: PointerEvent) =>
              setView({
                ...original,
                x: original.x + pointer.clientX - startX,
                y: original.y + pointer.clientY - startY,
              });
            const finish = () => {
              element.removeEventListener('pointermove', move);
              element.removeEventListener('pointerup', finish);
              element.removeEventListener('pointercancel', finish);
            };
            element.addEventListener('pointermove', move);
            element.addEventListener('pointerup', finish);
            element.addEventListener('pointercancel', finish);
          }}
        >
          {!nodes.length && (
            <p className="idea-no-content">Every idea starts somewhere. Add your first idea.</p>
          )}
          <div
            className="idea-plane"
            style={
              list
                ? undefined
                : {
                    transform:
                      'translate(' + view.x + 'px,' + view.y + 'px) scale(' + view.zoom + ')',
                  }
            }
          >
            {!list && (
              <svg className="idea-threads" aria-hidden="true">
                {edges
                  .filter(
                    (edge) =>
                      nodes.some(
                        (node) =>
                          node.id === edge.from && visible.some((item) => item.id === node.id),
                      ) && visible.some((node) => node.id === edge.to),
                  )
                  .map((edge) => {
                    const a = nodes.find((node) => node.id === edge.from)!;
                    const b = nodes.find((node) => node.id === edge.to)!;
                    const ap = moving?.id === a.id ? moving : a.position;
                    const bp = moving?.id === b.id ? moving : b.position;
                    const dx = bp.x - ap.x;
                    const dy = bp.y - ap.y;
                    const aw = a.width ?? 200;
                    const ah = a.height ?? 80;
                    const bw = b.width ?? 200;
                    const bh = b.height ?? 80;
                    const horizontal = Math.abs(dx) > Math.abs(dy);
                    const ax = ap.x + (horizontal ? (dx >= 0 ? aw : 0) : aw / 2);
                    const ay = ap.y + (horizontal ? ah / 2 : dy >= 0 ? ah : 0);
                    const bx = bp.x + (horizontal ? (dx >= 0 ? 0 : bw) : bw / 2);
                    const by = bp.y + (horizontal ? bh / 2 : dy >= 0 ? 0 : bh);
                    return <path key={edge.id} d={threadPath(ax, ay, bx, by)} />;
                  })}
                {connectionPreview && (
                  <path
                    className="idea-thread-preview"
                    d={threadPath(
                      connectionPreview.x1,
                      connectionPreview.y1,
                      connectionPreview.x2,
                      connectionPreview.y2,
                    )}
                  />
                )}
              </svg>
            )}
            {visible.map((node) => {
              const nodeEdges = edges.filter(
                (edge) => edge.from === node.id || edge.to === node.id,
              );
              const peerFor = (edge: (typeof edges)[number]) =>
                nodes.find((other) => other.id === (edge.from === node.id ? edge.to : edge.from));
              return (
                <div
                  className={
                    'idea-node ' +
                    (selected === node.id ? 'selected ' : '') +
                    (openMenu === node.id ? 'settings-open' : '')
                  }
                  data-idea-node={node.id}
                  data-tone={node.tone ?? 'paper'}
                  key={node.id}
                  style={
                    list
                      ? node.width
                        ? { width: node.width }
                        : undefined
                      : {
                          left: moving?.id === node.id ? moving.x : node.position.x,
                          top: moving?.id === node.id ? moving.y : node.position.y,
                          width: node.width ?? 200,
                          ...(node.height ? { height: node.height } : {}),
                        }
                  }
                  onFocusCapture={() => setSelected(node.id)}
                >
                  {editing?.id === node.id && editing.field === 'title' ? (
                    <DraftField
                      key={node.id + '-title'}
                      className="idea-inline-title"
                      label={'Rename idea: ' + node.title}
                      value={node.title}
                      maxLength={120}
                      required
                      autoFocus
                      selectOnFocus
                      onBlurComplete={() => closeInlineEditor(node.id, 'title')}
                      onSave={(expected, value) => saveNodeField(node, 'title', expected, value)}
                    />
                  ) : (
                    <button
                      className="idea-node-title"
                      aria-label={'Rename idea: ' + node.title}
                      title="Click to rename; drag to move"
                      onClick={() => activateNode(node, 'title')}
                      onPointerDown={(event) => moveNode(event, node)}
                    >
                      {node.title}
                    </button>
                  )}
                  <button
                    className="idea-node-menu"
                    type="button"
                    aria-label={'Settings for ' + node.title}
                    aria-expanded={openMenu === node.id}
                    onClick={() => {
                      setSelected(node.id);
                      setOpenMenu((current) => (current === node.id ? null : node.id));
                      setDeleteId(null);
                    }}
                  >
                    ⋮
                  </button>
                  {editing?.id === node.id && editing.field === 'body' ? (
                    <DraftField
                      key={node.id + '-body'}
                      className="idea-inline-body"
                      multiline
                      label={'Text for ' + node.title}
                      value={node.body}
                      maxLength={4000}
                      autoFocus
                      placeholder="Add a thought…"
                      onBlurComplete={() => closeInlineEditor(node.id, 'body')}
                      onSave={(expected, value) => saveNodeField(node, 'body', expected, value)}
                    />
                  ) : (
                    <button
                      className="idea-node-body"
                      type="button"
                      aria-label={'Edit text for ' + node.title}
                      onClick={() => activateNode(node, 'body')}
                    >
                      {node.body ? node.body.slice(0, 85) : <span>Add a thought…</span>}
                    </button>
                  )}
                  {(['left', 'right', 'top', 'bottom'] as PortSide[]).map((side) => (
                    <button
                      className={'idea-port idea-port-' + side}
                      type="button"
                      data-idea-port={node.id}
                      data-port-side={side}
                      aria-label={'Start a connection from ' + node.title + ' (' + side + ')'}
                      key={side}
                      onPointerDown={(event) => startConnection(event, node)}
                      onClick={() => handlePortClick(node.id)}
                    >
                      <span />
                    </button>
                  ))}
                  {openMenu === node.id && (
                    <div
                      className="idea-node-settings"
                      id={'idea-settings-' + node.id}
                      role="region"
                      aria-label={'Settings for ' + node.title}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="idea-node-customize">
                        <h3>Appearance</h3>
                        <div className="idea-node-setting">
                          <span className="idea-menu-setting-label">Color</span>
                          <div
                            className="idea-node-tone-options"
                            role="group"
                            aria-label={'Color for ' + node.title}
                          >
                            {nodeTones.map((tone) => (
                              <button
                                type="button"
                                key={tone.id}
                                aria-label={tone.label}
                                title={tone.label}
                                aria-pressed={(node.tone ?? 'paper') === tone.id}
                                onClick={() => customizeNode(node, { tone: tone.id })}
                              >
                                <span style={{ backgroundColor: tone.color }} />
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="idea-node-setting">
                          <span className="idea-menu-setting-label">Size</span>
                          <div
                            className="idea-node-size-options"
                            role="group"
                            aria-label={'Size for ' + node.title}
                          >
                            {nodeSizes.map((size) => (
                              <button
                                type="button"
                                key={size.label}
                                aria-pressed={(node.width ?? 200) === size.width}
                                onClick={() => customizeNode(node, { width: size.width })}
                              >
                                {size.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <h3>
                        Connections <span>{nodeEdges.length}</span>
                      </h3>
                      {!nodeEdges.length && (
                        <p className="idea-menu-empty">
                          No connections yet. Drag a thread to another idea.
                        </p>
                      )}
                      {nodeEdges.map((edge) => {
                        const peer = peerFor(edge);
                        if (!peer) return null;
                        const direction = edge.from === node.id ? 'to' : 'from';
                        return (
                          <div className="idea-connection-row" key={edge.id}>
                            <div>
                              <strong>{peer.title}</strong>
                              <span>Connected {direction}</span>
                            </div>
                            <button
                              type="button"
                              aria-label={'Remove connection ' + direction + ' ' + peer.title}
                              onClick={() => void removeConnection(edge)}
                            >
                              Remove
                            </button>
                          </div>
                        );
                      })}
                      <div className="idea-menu-move" role="group" aria-label="Move idea">
                        {moveDirections.map((direction) => (
                          <button
                            type="button"
                            aria-label={direction.label}
                            title={direction.label}
                            key={direction.label}
                            onClick={() => moveNodeBy(node, direction.x, direction.y)}
                          >
                            <Icon name={direction.symbol as IconName} />
                          </button>
                        ))}
                      </div>
                      {deleteId === node.id ? (
                        <div
                          className="idea-delete-confirm"
                          role="group"
                          aria-label={'Confirm deletion of ' + node.title}
                        >
                          <p>Delete this idea and its connections? Undo can restore them.</p>
                          <button
                            type="button"
                            className="idea-delete-confirm-action"
                            onClick={() => deleteIdea(node)}
                          >
                            Confirm delete
                          </button>
                          <button type="button" onClick={() => setDeleteId(null)}>
                            Keep idea
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="idea-delete-action"
                          onClick={() => setDeleteId(node.id)}
                        >
                          Delete idea
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
