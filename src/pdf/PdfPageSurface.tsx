import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { TextLayer, type PDFPageProxy } from 'pdfjs-dist';
import type { PdfMark, PdfPoint, PdfTool } from './pdf-types';
import type { PDFDocumentProxy } from './pdf-engine';

interface Props {
  page: PDFPageProxy;
  pageNumber: number;
  scale: number;
  viewRotation: number;
  tool: PdfTool;
  color: string;
  highlightOpacity: number;
  strokeWidth: number;
  selectedMarkId: string | null;
  marks: PdfMark[];
  searchTerm: string;
  onAddMark: (mark: PdfMark) => void;
  onEraseMark: (id: string) => void;
  onPlaceNote: (point: PdfPoint) => void;
  onRendered?: (size: { width: number; height: number }) => void;
}

type Draft = { start: PdfPoint; end: PdfPoint; points: PdfPoint[] };

export function PdfPageSurface({
  page,
  pageNumber,
  scale,
  viewRotation,
  tool,
  color,
  highlightOpacity,
  strokeWidth,
  selectedMarkId,
  marks,
  searchTerm,
  onAddMark,
  onEraseMark,
  onPlaceNote,
  onRendered,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [textLayerReady, setTextLayerReady] = useState(0);
  const viewport = useMemo(
    () => page.getViewport({ scale, rotation: (page.rotate + viewRotation) % 360 }),
    [page, scale, viewRotation],
  );
  const editable = tool === 'Highlight' || tool === 'Note' || tool === 'Draw' || tool === 'Eraser';
  const pageMarks = marks.filter((mark) => mark.page === pageNumber);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pixelLimitScale = Math.sqrt(24_000_000 / Math.max(1, viewport.width * viewport.height));
    const outputScale = Math.min(window.devicePixelRatio || 1, 2, pixelLimitScale);
    canvas.width = Math.ceil(viewport.width * outputScale);
    canvas.height = Math.ceil(viewport.height * outputScale);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    const renderTask = page.render({
      canvas,
      viewport,
      transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
      background: '#fffdf8',
    });
    void renderTask.promise
      .then(() => onRendered?.({ width: viewport.width, height: viewport.height }))
      .catch(() => {});
    return () => renderTask.cancel();
  }, [page, viewport, onRendered]);

  useEffect(() => {
    const container = textLayerRef.current;
    if (!container) return;
    container.replaceChildren();
    container.style.width = `${viewport.width}px`;
    container.style.height = `${viewport.height}px`;
    container.style.setProperty('--scale-factor', String(viewport.scale));
    container.style.setProperty('--user-unit', '1');
    container.style.setProperty('--total-scale-factor', String(viewport.scale));
    let layer: TextLayer | null = null;
    let cancelled = false;
    try {
      layer = new TextLayer({
        textContentSource: page.streamTextContent({ includeMarkedContent: true }),
        container,
        viewport,
      });
      void layer
        .render()
        .then(() => {
          if (!cancelled) setTextLayerReady((value) => value + 1);
        })
        .catch(() => {});
    } catch {
      /* Image-only PDFs still render and accept ink and note marks. */
    }
    return () => {
      cancelled = true;
      layer?.cancel();
      container.replaceChildren();
    };
  }, [page, viewport]);

  useEffect(() => {
    const layer = textLayerRef.current;
    if (!layer) return;
    const needle = searchTerm.trim().toLocaleLowerCase();
    layer.querySelectorAll('span').forEach((span) => {
      span.classList.toggle(
        'pdf-search-hit',
        !!needle && (span.textContent ?? '').toLocaleLowerCase().includes(needle),
      );
    });
  }, [searchTerm, textLayerReady]);

  function viewportPoint(event: ReactPointerEvent<SVGSVGElement>): PdfPoint {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) * viewport.width) / Math.max(1, rect.width);
    const y = ((event.clientY - rect.top) * viewport.height) / Math.max(1, rect.height);
    const [pdfX, pdfY] = viewport.convertToPdfPoint(x, y);
    return { x: pdfX, y: pdfY };
  }

  function pointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (tool === 'Note') {
      event.preventDefault();
      onPlaceNote(viewportPoint(event));
      return;
    }
    if (tool === 'Eraser') {
      event.preventDefault();
      const target = (event.target as Element).closest<SVGElement>('[data-mark-id]');
      const id = target?.dataset.markId;
      if (id) onEraseMark(id);
      return;
    }
    if (tool !== 'Highlight' && tool !== 'Draw') return;
    event.preventDefault();
    const point = viewportPoint(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraft({ start: point, end: point, points: [point] });
  }

  function pointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (!draft) return;
    event.preventDefault();
    const point = viewportPoint(event);
    setDraft((current) =>
      current ? { ...current, end: point, points: [...current.points, point] } : current,
    );
  }

  function pointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    if (!draft) return;
    event.preventDefault();
    const end = viewportPoint(event);
    if (tool === 'Highlight') {
      const rect = {
        x: Math.min(draft.start.x, end.x),
        y: Math.min(draft.start.y, end.y),
        width: Math.abs(end.x - draft.start.x),
        height: Math.abs(end.y - draft.start.y),
      };
      if (rect.width > 2 && rect.height > 2)
        onAddMark({
          id: crypto.randomUUID(),
          page: pageNumber,
          type: 'highlight',
          color,
          rect,
          opacity: highlightOpacity,
        });
    } else if (tool === 'Draw' && draft.points.length > 1) {
      onAddMark({
        id: crypto.randomUUID(),
        page: pageNumber,
        type: 'ink',
        color,
        points: [...draft.points, end],
        thickness: strokeWidth,
      });
    }
    setDraft(null);
  }

  function viewportRect(rect: { x: number; y: number; width: number; height: number }) {
    const corners = [
      viewport.convertToViewportPoint(rect.x, rect.y),
      viewport.convertToViewportPoint(rect.x + rect.width, rect.y),
      viewport.convertToViewportPoint(rect.x, rect.y + rect.height),
      viewport.convertToViewportPoint(rect.x + rect.width, rect.y + rect.height),
    ];
    const xs = corners.map((point) => point[0] as number);
    const ys = corners.map((point) => point[1] as number);
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    return { x: left, y: top, width: Math.max(...xs) - left, height: Math.max(...ys) - top };
  }

  function viewportPath(points: PdfPoint[]) {
    return points
      .map((point, index) => {
        const [x, y] = viewport.convertToViewportPoint(point.x, point.y);
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ');
  }

  const draftRect =
    draft && tool === 'Highlight'
      ? viewportRect({
          x: Math.min(draft.start.x, draft.end.x),
          y: Math.min(draft.start.y, draft.end.y),
          width: Math.abs(draft.end.x - draft.start.x),
          height: Math.abs(draft.end.y - draft.start.y),
        })
      : null;

  return (
    <div className="pdf-page-surface" style={{ width: viewport.width, height: viewport.height }}>
      <canvas ref={canvasRef} className="pdf-render-canvas" aria-label={`PDF page ${pageNumber}`} />
      <div
        ref={textLayerRef}
        className="textLayer"
        aria-label={`Selectable text on page ${pageNumber}`}
      />
      <svg
        className={`pdf-markup-layer${editable ? ' is-editable' : ''}`}
        viewBox={`0 0 ${viewport.width} ${viewport.height}`}
        width={viewport.width}
        height={viewport.height}
        aria-label={`${tool} layer on page ${pageNumber}`}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
      >
        {pageMarks.map((mark) => {
          if (mark.type === 'highlight') {
            const rect = viewportRect(mark.rect);
            return (
              <rect
                key={mark.id}
                id={`pdf-mark-${mark.id}`}
                data-mark-id={mark.id}
                data-selected={selectedMarkId === mark.id || undefined}
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                fill={mark.color}
                fillOpacity={mark.opacity}
                rx="2"
              />
            );
          }
          if (mark.type === 'ink')
            return (
              <path
                key={mark.id}
                id={`pdf-mark-${mark.id}`}
                data-mark-id={mark.id}
                data-selected={selectedMarkId === mark.id || undefined}
                d={viewportPath(mark.points)}
                fill="none"
                stroke={mark.color}
                strokeWidth={mark.thickness}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          const [x, y] = viewport.convertToViewportPoint(mark.point.x, mark.point.y);
          return (
            <g
              key={mark.id}
              id={`pdf-mark-${mark.id}`}
              data-mark-id={mark.id}
              data-selected={selectedMarkId === mark.id || undefined}
              className="pdf-note-mark"
              transform={`translate(${x} ${y})`}
            >
              <circle r="8" fill={mark.color} />
              <text textAnchor="middle" dominantBaseline="central">
                ✎
              </text>
              <title>{mark.text}</title>
            </g>
          );
        })}
        {draft && tool === 'Draw' && (
          <path
            d={viewportPath(draft.points)}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {draftRect && (
          <rect
            x={draftRect.x}
            y={draftRect.y}
            width={draftRect.width}
            height={draftRect.height}
            fill={color}
            fillOpacity={highlightOpacity * 0.7}
            stroke={color}
            strokeWidth="1"
            strokeDasharray="5 4"
          />
        )}
      </svg>
    </div>
  );
}

export function PageThumbnail({
  document,
  pageNumber,
  viewRotation = 0,
}: {
  document: PDFDocumentProxy;
  pageNumber: number;
  viewRotation?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '120px' },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderTask: ReturnType<PDFPageProxy['render']> | undefined;
    let cancelled = false;
    void document
      .getPage(pageNumber)
      .then((page) => {
        if (cancelled) return;
        const rotation = (page.rotate + viewRotation) % 360;
        const base = page.getViewport({ scale: 1, rotation });
        const scale = Math.min(92 / base.width, 116 / base.height);
        const viewport = page.getViewport({ scale, rotation });
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        if (!canvas.getContext('2d', { alpha: false })) return;
        const task = page.render({ canvas, viewport, background: '#fffdf8' });
        renderTask = task;
        return task.promise;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [document, pageNumber, viewRotation, visible]);

  return (
    <div ref={hostRef} className="pdf-thumbnail-canvas" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
