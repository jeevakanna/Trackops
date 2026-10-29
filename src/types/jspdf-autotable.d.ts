declare module 'jspdf-autotable' {
  import { jsPDF } from 'jspdf';

  export interface UserOptions {
    startY?: number;
    head?: any[][];
    body?: any[][];
    foot?: any[][];
    theme?: 'striped' | 'grid' | 'plain';
    headStyles?: Record<string, any>;
    styles?: Record<string, any>;
    alternateRowStyles?: Record<string, any>;
    columnStyles?: Record<string | number, any>;
    margin?: number | { top?: number; right?: number; bottom?: number; left?: number };
    didDrawPage?: (data: any) => void;
    didParseCell?: (data: any) => void;
    [key: string]: any;
  }

  function autoTable(doc: jsPDF, options: UserOptions): void;

  export default autoTable;
}
