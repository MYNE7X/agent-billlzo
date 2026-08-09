export type ExportColumn<T> = { key: keyof T & string; label: string };

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const cell = (v: unknown) => (v == null ? "" : String(v));

export function exportCSV<T extends Record<string, unknown>>(
  rows: T[],
  columns: ExportColumn<T>[],
  filename: string,
) {
  const head = columns.map((c) => `"${c.label}"`).join(",");
  const body = rows
    .map((r) => columns.map((c) => `"${cell(r[c.key]).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  download(new Blob([`${head}\n${body}`], { type: "text/csv;charset=utf-8;" }), `${filename}.csv`);
}

export async function exportExcel<T extends Record<string, unknown>>(
  rows: T[],
  columns: ExportColumn<T>[],
  filename: string,
) {
  const XLSX = await import("xlsx");
  const data = rows.map((r) => Object.fromEntries(columns.map((c) => [c.label, cell(r[c.key])])));
  const sheet = XLSX.utils.json_to_sheet(data);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Report");
  const out = XLSX.write(book, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  download(
    new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${filename}.xlsx`,
  );
}

export async function exportPDF<T extends Record<string, unknown>>(
  rows: T[],
  columns: ExportColumn<T>[],
  filename: string,
  title: string,
) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(16);
  doc.text(title, 40, 40);
  doc.setFontSize(9);
  doc.text(`Generated ${new Date().toLocaleString("en-PK")} · Billzo Office Management System`, 40, 58);
  autoTable(doc, {
    startY: 74,
    head: [columns.map((c) => c.label)],
    body: rows.map((r) => columns.map((c) => cell(r[c.key]))),
    styles: { fontSize: 8, cellPadding: 5 },
    headStyles: { fillColor: [22, 40, 52], textColor: 255 },
    alternateRowStyles: { fillColor: [244, 248, 249] },
  });
  doc.save(`${filename}.pdf`);
}