import {
  GlobalWorkerOptions,
  PasswordException,
  PasswordResponses,
  getDocument,
  type PDFDocumentProxy,
} from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { LineCapStyle, PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import type { PdfMark } from './pdf-types';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export { PasswordException, PasswordResponses };
export type { PDFDocumentProxy };

export function loadPdf(bytes: Uint8Array) {
  const root = document.baseURI;
  return getDocument({
    data: bytes.slice(),
    cMapUrl: new URL('pdfjs/cmaps/', root).toString(),
    cMapPacked: true,
    standardFontDataUrl: new URL('pdfjs/standard_fonts/', root).toString(),
    useWasm: false,
    enableXfa: true,
  });
}

function toColor(value: string) {
  const hex = value.replace('#', '');
  const normalized = hex.length === 3 ? hex.split('').map(char => char + char).join('') : hex;
  const number = Number.parseInt(normalized, 16);
  return rgb(((number >> 16) & 255) / 255, ((number >> 8) & 255) / 255, (number & 255) / 255);
}

function drawMark(page: ReturnType<PDFDocument['getPage']>, mark: PdfMark, font: Awaited<ReturnType<PDFDocument['embedFont']>>) {
  const color = toColor(mark.color);
  if (mark.type === 'highlight') {
    page.drawRectangle({
      x: mark.rect.x,
      y: mark.rect.y,
      width: mark.rect.width,
      height: mark.rect.height,
      color,
      opacity: mark.opacity,
      borderOpacity: 0,
    });
  } else if (mark.type === 'note') {
    page.drawCircle({ x: mark.point.x, y: mark.point.y, size: 8, color, opacity: 0.95 });
    page.drawText(mark.text, {
      x: mark.point.x + 12,
      y: mark.point.y - 4,
      size: 11,
      font,
      color: rgb(0.16, 0.18, 0.17),
      maxWidth: 220,
      lineHeight: 14,
      opacity: 0.98,
    });
  } else {
    for (let index = 1; index < mark.points.length; index += 1) {
      const start = mark.points[index - 1];
      const end = mark.points[index];
      if (!start || !end) continue;
      page.drawLine({
        start: { x: start.x, y: start.y },
        end: { x: end.x, y: end.y },
        thickness: mark.thickness,
        color,
        opacity: 0.9,
        lineCap: LineCapStyle.Round,
      });
    }
  }
}

export async function exportPdf(
  sourceBytes: Uint8Array,
  sourcePageOrder: number[],
  marks: PdfMark[],
  pageRotations: number[],
  onlyPageIndex?: number,
): Promise<Uint8Array> {
  const source = await PDFDocument.load(sourceBytes, { updateMetadata: false });
  const ordered = onlyPageIndex === undefined ? sourcePageOrder : [sourcePageOrder[onlyPageIndex - 1]].filter((value): value is number => value !== undefined);
  const isReordered = ordered.length !== source.getPageCount() || ordered.some((pageNumber, index) => pageNumber !== index + 1);
  let output: PDFDocument;
  let outputPages: ReturnType<PDFDocument['getPage']>[];

  if (isReordered) {
    output = await PDFDocument.create();
    if (source.getTitle()) output.setTitle(source.getTitle()!);
    if (source.getAuthor()) output.setAuthor(source.getAuthor()!);
    outputPages = await output.copyPages(source, ordered.map(pageNumber => pageNumber - 1));
    outputPages.forEach(page => output.addPage(page));
  } else {
    output = source;
    outputPages = output.getPages();
  }

  const font = await output.embedFont(StandardFonts.Helvetica);
  for (let outputIndex = 0; outputIndex < ordered.length; outputIndex += 1) {
    const sourcePageNumber = ordered[outputIndex];
    const page = outputPages[outputIndex];
    if (!sourcePageNumber || !page) continue;
    const extraRotation = pageRotations[onlyPageIndex === undefined ? outputIndex : onlyPageIndex - 1] ?? 0;
    if (extraRotation) page.setRotation(degrees((page.getRotation().angle + extraRotation + 360) % 360));
    marks.filter(mark => mark.page === sourcePageNumber).forEach(mark => drawMark(page, mark, font));
  }
  return output.save({ useObjectStreams: false });
}

export async function mergePdfs(files: File[], onProgress?: (value: string) => void): Promise<Uint8Array> {
  if (files.length === 0) throw new Error('Choose at least one PDF to merge.');
  const merged = await PDFDocument.create();
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    if (!file) continue;
    onProgress?.(`Reading ${file.name} (${index + 1} of ${files.length})…`);
    const source = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()));
    const copied = await merged.copyPages(source, source.getPageIndices());
    copied.forEach(page => merged.addPage(page));
  }
  if (files[0]?.name) merged.setTitle(`Merged · ${files[0].name.replace(/\.pdf$/i, '')}`);
  return merged.save({ useObjectStreams: false });
}

export function savePdf(bytes: Uint8Array, fileName: string) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function isPasswordError(error: unknown): error is PasswordException {
  return error instanceof PasswordException;
}
