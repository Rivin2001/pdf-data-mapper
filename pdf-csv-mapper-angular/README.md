# PDF to CSV Mapper — Angular 17 (NgModule) + PHP

This project ports your vanilla HTML/CSS/JS into an Angular 17 (no-standalone, uses NgModule) frontend and a lightweight PHP backend for optional file uploads.

## Quick Start

### 1) Backend (PHP)

```bash
cd backend
php -S localhost:8080 -t public
```
- API endpoints: `/api/health.php`, `/api/upload.php`
- Uploaded files saved to `backend/uploads/`

### 2) Frontend (Angular 17)

```bash
cd frontend
npm install
npm start
```
- App opens at `http://localhost:4200`.
- Proxy sends `/api/*` to `http://localhost:8080`.

## Notes

- All PDF parsing, CSV/Excel parsing, Tesseract OCR, and Excel export happen client-side using `pdfjs-dist`, `papaparse`, `tesseract.js`, and `xlsx`.
- The PHP backend is used to store files if desired; the Angular app will still process files locally.
- The `pdf.worker.min.js` is loaded via CDN to avoid bundler worker-path issues.

## Structure

- `frontend/` — Angular app
- `backend/` — PHP API + public web root
