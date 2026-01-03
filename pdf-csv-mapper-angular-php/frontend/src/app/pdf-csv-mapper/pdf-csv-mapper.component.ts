import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

import * as pdfjsLib from 'pdfjs-dist';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import Tesseract from 'tesseract.js';

(pdfjsLib as any).GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.12.313/pdf.worker.min.js';  

type Mapping = { header: string; value: string; };

@Component({
  selector: 'app-pdf-csv-mapper',
  templateUrl: './pdf-csv-mapper.component.html',
  styleUrls: ['./pdf-csv-mapper.component.css']
})
export class PdfCsvMapperComponent {
  // UI state
  pdfFileName = '';
  csvFileName = '';
  statusMessage = '';
  statusType: 'success' | 'error' | '' = '';
  showPdfProgress = false;
  pdfProgress = 0;
  documentHasData = false;

  // Data
  pdfText = '';
  pageImages: string[] = [];

  csvHeaders: string[] = [];
  csvPreviewHeaders: string[] = [];
  csvPreviewRows: any[][] = [];

  mappedData: Mapping[] = [];

  constructor(private http: HttpClient) {}

  // ------------------- UI helpers -------------------
  private showStatusMessage(text: string, type: 'success' | 'error' = 'success') {
    this.statusMessage = text;
    this.statusType = type;
    setTimeout(() => { this.statusMessage = ''; this.statusType = ''; }, 5000);
  }
  private setProgress(p: number) {
    this.pdfProgress = Math.max(0, Math.min(100, p));
  }

  // ------------------- File handlers -------------------
  async onPdfSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) return;

    this.pdfFileName = file.name;
    this.showPdfProgress = true;        // FIXED
    this.setProgress(0);
    this.pageImages = [];
    this.pdfText = '';

    // Optional: send to backend for storage (non-blocking)
    const form = new FormData();
    form.append('pdfFile', file);
    this.http.post(environment.API_BASE + '/upload.php', form).subscribe({ next: () => {}, error: () => {} });

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf: any = await (pdfjsLib as any).getDocument({ data: arrayBuffer }).promise; // FIXED
      let fullText = '';
      const totalPages = pdf.numPages;

      for (let i = 1; i <= totalPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context, viewport }).promise;

        const imgUrl = canvas.toDataURL();
        this.pageImages.push(imgUrl);

        // Try native text
        const textContent = await page.getTextContent();
        let pageText = '';
        let lastY: number | null = null;
        (textContent.items as any[]).forEach((item: any) => {
          const y = item.transform[5];
          if (lastY !== null && Math.abs(y - lastY) > 5) pageText += '\n';
          pageText += item.str + ' ';
          lastY = y;
        });

        const needOCR = pageText.trim().length < 20;
        if (needOCR) {
          try {
            const { data: { text: ocrText } } = await (Tesseract as any).recognize(canvas, 'eng');
            pageText = (ocrText || '');
          } catch (e) {
            console.warn('OCR failed', e);
          }
        }

        pageText = pageText
          .replace(/\u00A0/g, ' ')
          .replace(/[‐–—−-]/g, '-')
          .replace(/[：﹕]/g, ':')
          .replace(/\s+\n/g, '\n')
          .trim();

        fullText += pageText + '\n\n';
        this.setProgress((i / totalPages) * 100);
      }

      this.pdfText = fullText;
      this.documentHasData = true;     // FIXED
      this.showStatusMessage('PDF processed successfully!');
      this.tryAutoMap();
    } catch (err: any) {
      console.error(err);
      this.showStatusMessage('Error processing PDF: ' + (err?.message || err), 'error');
    } finally {
      this.showPdfProgress = false;    // FIXED
    }
  }

  async onCsvSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) return;

    this.csvFileName = file.name;
    this.csvHeaders = [];
    this.csvPreviewHeaders = [];
    this.csvPreviewRows = [];

    // Optional: send to backend for storage (non-blocking)
    const form = new FormData();
    form.append('csvFile', file);
    this.http.post(environment.API_BASE + '/upload.php', form).subscribe({ next: () => {}, error: () => {} });

    try {
      if (file.name.endsWith('.csv')) {
        this.processCsvFile(file);
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        await this.processExcelFile(file);
      } else {
        this.showStatusMessage('Unsupported file type', 'error');
      }
    } catch (err: any) {
      this.showStatusMessage('Error processing file: ' + (err?.message || err), 'error');
    }
  }

  private processCsvFile(file: File) {
    Papa.parse(file, {
      complete: (results: Papa.ParseResult<any>) => {
        if (results.data.length > 0) {
          this.csvHeaders = results.data[0].map((h: any) => String(h || '').trim());
          this.prepareCsvPreview(results.data);
          this.documentHasData = true;    // FIXED
          this.showStatusMessage('CSV file loaded successfully!');
          this.tryAutoMap();
        } else {
          this.showStatusMessage('CSV file is empty or invalid', 'error');
        }
      },
      error: (error: any) => {
        this.showStatusMessage('Error parsing CSV: ' + error.message, 'error');
      },
      header: false,                      // FIXED
      skipEmptyLines: 'greedy' as any
    });
  }

  private async processExcelFile(file: File) {
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    const cleaned = jsonData.filter(r => Array.isArray(r) && r.some(c => String(c ?? '').trim() !== ''));

    if (cleaned.length > 0) {
      this.csvHeaders = cleaned[0].map((h: any) => String(h || '').trim());
      this.prepareCsvPreview(cleaned);
      this.documentHasData = true;        // FIXED
      this.showStatusMessage('Excel file loaded successfully!');
      this.tryAutoMap();
    } else {
      this.showStatusMessage('Excel file is empty or invalid', 'error');
    }
  }

  private prepareCsvPreview(data: any[][]) {
    this.csvPreviewHeaders = data[0] || [];
    const rowLimit = Math.min(data.length, 11);
    this.csvPreviewRows = [];
    for (let i = 1; i < rowLimit; i++) this.csvPreviewRows.push(data[i]);
    if (data.length > 11) {
      const more = [`... and ${data.length - 11} more rows`];
      this.csvPreviewRows.push([more.join(' ')]);
    }
  }

  // ------------------- Auto map logic -------------------
  private tryAutoMap() {
    if (this.pdfText && this.csvHeaders.length > 0) {
      this.autoMapData();
    }
  }

  private normalize(s: string) {
    return String(s || '')
      .replace(/\u00A0/g, ' ')
      .toLowerCase()
      .replace(/[‐–—−-]/g, '-')
      .replace(/[：﹕]/g, ':')
      .replace(/[^\p{L}\p{N}\s\-()\/&.]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private tokenize(s: string) {
    return this.normalize(s).split(/\s+/).filter(Boolean);
  }

  private levDist(a: string, b: string) {
    a = this.normalize(a); b = this.normalize(b);
    const m = Array.from({ length: a.length + 1 }, (_, i) => i);
    for (let j = 1; j <= b.length; j++) {
      let prev = m[0], cur = j; m[0] = j;
      for (let i = 1; i <= a.length; i++) {
        const tmp = m[i];
        m[i] = Math.min(
          m[i] + 1,
          m[i - 1] + 1,
          prev + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
        prev = tmp;
      }
    }
    return m[a.length];
  }

  private jaccard(a: string, b: string) {
    const A = new Set(this.tokenize(a));
    const B = new Set(this.tokenize(b));
    const inter = [...A].filter(x => B.has(x)).length;
    const uni = new Set([...A, ...B]).size || 1;
    return inter / uni;
  }

  private scoreKey(csvHeader: string, pdfKey: string) {
    const h = this.normalize(csvHeader);
    const k = this.normalize(pdfKey);
    if (!h || !k) return 0;

    let score = 0;
    if (h === k) score += 0.65;
    if (k.includes(h) || h.includes(k)) score += 0.25;
    score += 0.6 * this.jaccard(h, k);

    const maxLen = Math.max(h.length, k.length) || 1;
    const ld = this.levDist(h, k);
    const sim = 1 - Math.min(ld / maxLen, 1);
    score += 0.35 * sim;

    return Math.max(0, Math.min(1, score));
  }

  private extractKeyValuePairs(pdfLines: string[]) {
    const pairs: { keyRaw: string; keyNorm: string; valueRaw: string; }[] = [];
    const L = pdfLines
      .map(l => (l ?? '').replace(/\u00A0/g, ' '))
      .map(l => l.replace(/[‐–—−-]/g, '-'))
      .map(l => l.replace(/[：﹕]/g, ':'))
      .map(l => l.trim())
      .filter(Boolean);

    const SEP = '[:=\\-]'; // NOTE the double escape here because it's a string for RegExp

    for (let i = 0; i < L.length; i++) {
      const line = L[i];

      let m = line.match(new RegExp(`^([\\p{L}\\p{N}\\s()\\/&.\\-]{2,60})\\s*${SEP}\\s*(?:\\.+\\s*)?(.+)$`, 'u'));
      if (m && m[1] && m[2]) {
        const keyRaw = m[1].trim();
        const valueRaw = m[2].trim();
        pairs.push({ keyRaw, keyNorm: this.normalize(keyRaw), valueRaw });
        continue;
      }

      m = line.match(/^([\p{L}\p{N}\s()\/&.\-]{2,60})[ \t]{2,}(.{2,})$/u);
      if (m && m[1] && m[2]) {
        const keyRaw = m[1].trim().replace(/\s{2,}$/, '');
        const valueRaw = m[2].trim();
        pairs.push({ keyRaw, keyNorm: this.normalize(keyRaw), valueRaw });
        continue;
      }

      m = line.match(new RegExp(`^([\\p{L}\\p{N}\\s()\\/&.\\-]{2,60})\\s*${SEP}\\s*$`, 'u'));
      if (m && m[1] && i + 1 < L.length) {
        const keyRaw = m[1].trim();
        const valueRaw = L[i + 1].trim();
        if (valueRaw) {
          pairs.push({ keyRaw, keyNorm: this.normalize(keyRaw), valueRaw });
          i++;
          continue;
        }
      }
    }

    const seen = new Set<string>();
    return pairs.filter(p => {
      const k = p.keyNorm + '||' + p.valueRaw;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  private autoMapData() {
    this.mappedData = [];
    const pdfLines = this.pdfText.split(/\r?\n/);
    const pairs = this.extractKeyValuePairs(pdfLines);
    const keys = pairs.map(p => p.keyRaw);

    for (const header of this.csvHeaders) {
      let bestIdx = -1, bestScore = 0;

      for (let i = 0; i < keys.length; i++) {
        const s = this.scoreKey(header, keys[i]);
        if (s > bestScore) { bestScore = s; bestIdx = i; }
      }

      let value = 'Not found';
      if (bestIdx >= 0 && bestScore >= 0.45) {
        value = pairs[bestIdx].valueRaw.trim().replace(/[|;,]+$/, '');
      } else {
        const escaped = String(header)
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          .replace(/\s+/g, '\\s*');

        // FIXED: double-escape \\s inside new RegExp string
        const loose = new RegExp(`${escaped}\\s*(?:[:=\\-])?\\s*(?:\\.+\\s*)?(.+)$`, 'i');

        for (const raw of pdfLines) {
          const ln = (raw || '')
            .replace(/\u00A0/g, ' ')
            .replace(/[‐–—−-]/g, '-')
            .replace(/[：﹕]/g, ':');
          const m = ln.match(loose);
          if (m && m[1]) { value = m[1].trim(); break; }
        }

        if (value === 'Not found') {
          const norm = pdfLines.map(l => this.normalize(l));
          const reStart = new RegExp(`^${escaped}(\\s*[:=\\-]\\s*)?$`, 'i'); // FIXED: \\s*
          for (let i = 0; i < norm.length - 1; i++) {
            if (reStart.test(norm[i])) {
              const nxt = (pdfLines[i + 1] || '').trim();
              if (nxt) { value = nxt; break; }
            }
          }
        }
      }

      this.mappedData.push({ header, value });
    }
  }

  downloadExcel() {
    if (this.mappedData.length === 0) return;

    const headers = this.mappedData.map(i => i.header);
    const values = this.mappedData.map(i => i.value);
    const ws = XLSX.utils.aoa_to_sheet([headers, values]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mapped Data');
    XLSX.writeFile(wb, 'Mapped_Data.xlsx');
    this.showStatusMessage('Excel file downloaded successfully!');
  }
}
