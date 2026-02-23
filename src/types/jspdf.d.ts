// Simplified jsPDF type declarations to avoid TypeScript stack overflow
declare module 'jspdf' {
  export interface jsPDFOptions {
    orientation?: 'portrait' | 'landscape';
    unit?: 'mm' | 'pt' | 'px' | 'in' | 'cm';
    format?: string | number[];
  }
  
  export default class jsPDF {
    constructor(options?: jsPDFOptions);
    internal: {
      pageSize: {
        getWidth(): number;
        getHeight(): number;
      };
    };
    addImage(
      imageData: string,
      format: string,
      x: number,
      y: number,
      width: number,
      height: number
    ): void;
    addPage(): void;
    save(filename: string): void;
    output(type: 'blob'): Blob;
    output(type: 'arraybuffer'): ArrayBuffer;
    output(type: 'datauristring'): string;
  }
}
