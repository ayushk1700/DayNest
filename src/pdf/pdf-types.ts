export type PdfTool = 'Read' | 'Select' | 'Highlight' | 'Note' | 'Draw' | 'Eraser';
export type PdfPoint = { x: number; y: number };
export type PdfRect = { x: number; y: number; width: number; height: number };

export type PdfMark =
  | {
      id: string;
      page: number;
      color: string;
      type: 'highlight';
      rect: PdfRect;
      opacity: number;
    }
  | {
      id: string;
      page: number;
      color: string;
      type: 'note';
      point: PdfPoint;
      text: string;
    }
  | {
      id: string;
      page: number;
      color: string;
      type: 'ink';
      points: PdfPoint[];
      thickness: number;
    };

export interface PdfSession {
  bytes: Uint8Array;
  fileName: string;
  pageCount: number;
  title: string;
  author: string;
  fileSize: number;
}
