/** RFC-4180 CSV with spreadsheet formula-injection protection (OWASP). */
export function toCsv(rows: (string | number | null | undefined)[][]) {
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    if (typeof v !== "number" && /^[\s]*[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  return rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

export function downloadCsv(name: string, rows: (string | number | null | undefined)[][]) {
  const url = URL.createObjectURL(new Blob(["﻿" + toCsv(rows)], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
