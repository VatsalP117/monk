export interface PdfToken {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
}

export interface PdfLine {
  y: number;
  averageHeight: number;
  tokens: PdfToken[];
}

export interface PdfTextContentLike {
  items: unknown[];
}
