/* ══════════════════════════════════════════════════════════════════════════
   EXPORT UTILITIES — CSV and PDF export for financial tables
   Used across S11-S15 financial screens for audit-ready data export.
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Export a table dataset as a CSV file and trigger browser download.
 * @param filename - Name of the downloaded file (without extension)
 * @param headers  - Array of column header strings
 * @param rows     - 2D array of cell values (string[][])
 */
export function exportCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const csvContent = [
    headers.map(escape).join(','),
    ...rows.map(row => row.map(escape).join(',')),
  ].join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Export a table as a simple printable HTML document (opens print dialog = PDF).
 * @param title   - Document title
 * @param headers - Column headers
 * @param rows    - 2D array of cell values
 */
export function exportPDF(title: string, headers: string[], rows: (string | number)[][]) {
  const tableRows = rows.map(row =>
    `<tr>${row.map(cell => `<td style="border:1px solid #ddd;padding:6px 10px;font-size:11px;font-family:monospace">${cell}</td>`).join('')}</tr>`
  ).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; }
        h1 { font-size: 16px; color: #1B2A4A; margin-bottom: 4px; }
        .meta { font-size: 11px; color: #888; margin-bottom: 16px; }
        table { border-collapse: collapse; width: 100%; }
        th { background: #1B2A4A; color: white; padding: 8px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; }
        tr:nth-child(even) { background: #f8f9fb; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <p class="meta">Exported: ${new Date().toLocaleString()} · FPE Dashboard</p>
      <table>
        <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
      <script>window.onload=function(){window.print()}</script>
    </body>
    </html>
  `;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
