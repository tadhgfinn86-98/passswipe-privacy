// Output formats: CSV (Excel/Sheets-safe), JSON, NDJSON and a quick HTML table.
import { CSV_COLUMNS, toRow } from './lead.js';

export function csvEscape(value) {
  const str = value === null || value === undefined ? '' : String(value);
  // Defuse spreadsheet formula injection while keeping the text readable.
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCSV(leads, { columns = CSV_COLUMNS, bom = true } = {}) {
  const head = columns.join(',');
  const body = leads.map((lead) => {
    const row = toRow(lead);
    return columns.map((col) => csvEscape(row[col])).join(',');
  });
  return (bom ? '﻿' : '') + [head, ...body].join('\r\n') + '\r\n';
}

export function toJSON(leads) {
  return `${JSON.stringify(leads, null, 2)}\n`;
}

export function toNDJSON(leads) {
  return leads.map((lead) => JSON.stringify(lead)).join('\n') + '\n';
}

const escapeHtml = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function toHTML(leads, { title = 'Leads' } = {}) {
  const cols = ['score', 'name', 'category', 'phone', 'email', 'website', 'city', 'opportunities'];
  const rows = leads
    .map((lead) => {
      const row = toRow(lead);
      return `<tr>${cols
        .map((c) =>
          c === 'website' && row[c]
            ? `<td><a href="${escapeHtml(row[c])}" rel="nofollow noopener">${escapeHtml(row.domain)}</a></td>`
            : `<td>${escapeHtml(row[c])}</td>`,
        )
        .join('')}</tr>`;
    })
    .join('\n');
  return `<!doctype html><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>body{font:14px system-ui;margin:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}th{background:#f4f4f8}</style>
<h1>${escapeHtml(title)} (${leads.length})</h1>
<table><thead><tr>${cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>
${rows}
</tbody></table>`;
}

export function render(leads, format = 'csv', options = {}) {
  switch (String(format).toLowerCase()) {
    case 'json':
      return toJSON(leads);
    case 'ndjson':
    case 'jsonl':
      return toNDJSON(leads);
    case 'html':
      return toHTML(leads, options);
    case 'csv':
    default:
      return toCSV(leads, options);
  }
}
