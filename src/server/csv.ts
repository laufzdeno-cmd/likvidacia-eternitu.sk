export function csvCell(value: string | number | null | undefined) {
  let text = String(value ?? '');

  // Excel and similar spreadsheet apps can execute formula-looking cells.
  if (typeof value === 'string' && /^[=+\-@]/.test(value.trimStart())) text = `'${text}`;
  return /[",;\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
