/**
 * Tipos para la API BarcodeDetector (PWA Chrome Android)
 * Spec: https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector
 */

export interface BarcodeDetectorOptions {
  formats?: BarcodeFormat[];
}

export type BarcodeFormat =
  | 'ean_13'
  | 'ean_8'
  | 'upc_a'
  | 'upc_e'
  | 'code_128'
  | 'qr_code'
  | 'codabar'
  | 'code_39'
  | 'code_93'
  | 'data_matrix'
  | 'pdf417'
  | 'aztec';

export interface DetectedBarcode {
  rawValue: string;
  format: BarcodeFormat;
  cornerPoints: Array<{ x: number; y: number }>;
  boundingBox?: DOMRectReadOnly;
}

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

interface BarcodeDetectorConstructor {
  new (options?: BarcodeDetectorOptions): BarcodeDetector;
  getSupportedFormats(): Promise<BarcodeFormat[]>;
}

interface BarcodeDetector {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
