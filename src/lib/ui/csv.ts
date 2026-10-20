/**
 * CSV for spreadsheet apps (RFC 4180, CRLF, UTF-8 BOM so Excel reads ñ and
 * the en dash correctly). Cells that start like a formula are prefixed with
 * an apostrophe so opening an export can never run one.
 */

const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: string[][]): string {
  return `﻿${rows.map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;
}
