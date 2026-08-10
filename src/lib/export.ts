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
  sheetName = "Report",
) {
  const XLSX = await import("xlsx");
  const data = rows.map((r) => Object.fromEntries(columns.map((c) => [c.label, cell(r[c.key])])));
  const sheet = XLSX.utils.json_to_sheet(data);
  // Set column widths based on label length
  sheet["!cols"] = columns.map((c) => ({ wch: Math.max(c.label.length + 2, 12) }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName.slice(0, 31));
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

  // ── Load the Billzo logo ──────────────────────────────────────────────────
  let logoDataUrl: string | null = null;
  try {
    const resp = await fetch("/logo-pdf.png");
    if (resp.ok) {
      const blob = await resp.blob();
      logoDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
  } catch {
    // ignore
  }

  // Draw the logo at top-left, or fall back to a drawn mark
  const brandSize = 24;
  const brandX = 40;
  const brandY = 24;
  if (logoDataUrl) {
    doc.setFillColor(11, 15, 25);
    doc.roundedRect(brandX, brandY, brandSize, brandSize, 5, 5, "F");
    doc.addImage(logoDataUrl, "PNG", brandX, brandY, brandSize, brandSize, undefined, "FAST");
  } else {
    doc.setFillColor(76, 213, 184);
    doc.roundedRect(brandX, brandY, brandSize, brandSize, 5, 5, "F");
    doc.setTextColor(13, 20, 32);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("B", brandX + 8, brandY + 17);
  }

  // Title and timestamp next to the logo
  doc.setTextColor(20, 30, 45);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(title, brandX + brandSize + 10, brandY + 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 135, 155);
  doc.text(`Generated ${new Date().toLocaleString("en-PK")} · Billzo Office Management System`, brandX + brandSize + 10, brandY + 26);

  autoTable(doc, {
    startY: brandY + brandSize + 16,
    head: [columns.map((c) => c.label)],
    body: rows.map((r) => columns.map((c) => cell(r[c.key]))),
    styles: { fontSize: 8, cellPadding: 5 },
    headStyles: { fillColor: [22, 40, 52], textColor: 255 },
    alternateRowStyles: { fillColor: [244, 248, 249] },
  });
  doc.save(`${filename}.pdf`);
}

// ── Stylish attendance-specific PDF ─────────────────────────────────────────
// Uses a dark branded cover with the same gradient-feel as the app, a stats
// strip, and a status-colored table.

const STATUS_RGB: Record<string, [number, number, number]> = {
  present: [16, 185, 129], // emerald-500
  absent: [239, 68, 68], // red-500
  late: [245, 158, 11], // amber-500
  half_day: [59, 130, 246], // blue-500
  leave: [139, 92, 246], // violet-500
  holiday: [6, 182, 212], // cyan-500
};

export type AttendanceExportRow = {
  date: string;
  agentName: string;
  employeeId: string;
  department: string;
  clockIn: string;
  clockOut: string;
  hours: number | null;
  status: string;
  notes: string;
};

export type AttendanceExportSummary = {
  totalRecords: number;
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  leave: number;
  holiday: number;
  totalHours: number;
};

export async function exportAttendancePDF(
  rows: AttendanceExportRow[],
  filename: string,
  meta: {
    title: string;
    subtitle: string;
    periodLabel: string;
    summary: AttendanceExportSummary;
    filterLabel?: string;
  },
) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  // Portrait A4 for narrow tables, landscape if many columns
  const isLandscape = false;
  const doc = new jsPDF({
    orientation: isLandscape ? "landscape" : "portrait",
    unit: "pt",
    format: "a4",
  });

  // ── Load the Billzo logo as a data URL ────────────────────────────────────
  // Falls back gracefully to the drawn "B" mark if the logo fails to load.
  let logoDataUrl: string | null = null;
  try {
    const resp = await fetch("/logo-pdf.png");
    if (resp.ok) {
      const blob = await resp.blob();
      logoDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
  } catch {
    // ignore — we'll fall back to the drawn mark
  }

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 32;

  // ── COVER BAND (dark gradient-feel) ────────────────────────────────────────
  // Draw three overlapping rectangles to simulate a gradient.
  const bandH = 130;
  for (let i = 0; i < bandH; i++) {
    const t = i / bandH;
    const r = Math.round(13 + (15 - 13) * t);
    const g = Math.round(20 + (40 - 20) * t);
    const b = Math.round(32 + (60 - 32) * t);
    doc.setFillColor(r, g, b);
    doc.rect(0, i, pageW, 1, "F");
  }

  // Accent line at the top
  doc.setFillColor(76, 213, 184); // primary mint
  doc.rect(0, 0, pageW, 3, "F");

  // Brand mark — use the actual logo image, fall back to the "B" letter
  const brandSize = 36;
  const brandX = margin;
  const brandY = 30;
  if (logoDataUrl) {
    // Add a subtle rounded background behind the logo for contrast
    doc.setFillColor(11, 15, 25); // dark navy matching logo bg
    doc.roundedRect(brandX, brandY, brandSize, brandSize, 7, 7, "F");
    // Add the logo image
    doc.addImage(logoDataUrl, "PNG", brandX, brandY, brandSize, brandSize, undefined, "FAST");
  } else {
    // Fallback: drawn "B" mark
    doc.setFillColor(76, 213, 184);
    doc.roundedRect(brandX, brandY, brandSize, brandSize, 6, 6, "F");
    doc.setTextColor(13, 20, 32);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("B", brandX + 12, brandY + 24);
  }

  // Title
  doc.setTextColor(245, 247, 250);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(meta.title, margin + brandSize + 12, brandY + 18);

  // Subtitle
  doc.setTextColor(180, 195, 215);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(meta.subtitle, margin + brandSize + 12, brandY + 34);

  // Period badge (right-aligned)
  doc.setFillColor(255, 255, 255, 0.08);
  doc.setDrawColor(76, 213, 184);
  doc.setLineWidth(0.8);
  const badgeW = 160;
  const badgeH = 24;
  const badgeX = pageW - margin - badgeW;
  doc.roundedRect(badgeX, 38, badgeW, badgeH, 12, 12, "FD");
  doc.setTextColor(76, 213, 184);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(meta.periodLabel, badgeX + badgeW / 2, 53, { align: "center" });

  // Generated timestamp (bottom of band)
  doc.setTextColor(150, 170, 195);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Generated ${new Date().toLocaleString("en-PK")}`,
    margin,
    bandH - 12,
  );
  doc.text("Billzo Office Management System", pageW - margin, bandH - 12, { align: "right" });

  // ── STATS STRIP ────────────────────────────────────────────────────────────
  const stripY = bandH + 20;
  const stats: { label: string; value: string | number; color: [number, number, number] }[] = [
    { label: "TOTAL", value: meta.summary.totalRecords, color: [76, 213, 184] },
    { label: "PRESENT", value: meta.summary.present, color: STATUS_RGB.present! },
    { label: "ABSENT", value: meta.summary.absent, color: STATUS_RGB.absent! },
    { label: "LATE", value: meta.summary.late, color: STATUS_RGB.late! },
    { label: "LEAVE", value: meta.summary.leave, color: STATUS_RGB.leave! },
    { label: "HOURS", value: `${meta.summary.totalHours.toFixed(0)}h`, color: STATUS_RGB.half_day! },
  ];
  const statCardW = (pageW - margin * 2 - (stats.length - 1) * 8) / stats.length;
  stats.forEach((s, i) => {
    const x = margin + i * (statCardW + 8);
    // card background
    doc.setFillColor(245, 247, 250);
    doc.setDrawColor(225, 232, 240);
    doc.setLineWidth(0.6);
    doc.roundedRect(x, stripY, statCardW, 50, 6, 6, "FD");
    // accent left bar
    doc.setFillColor(s.color[0]!, s.color[1]!, s.color[2]!);
    doc.roundedRect(x, stripY, 3, 50, 1.5, 1.5, "F");
    // value
    doc.setTextColor(s.color[0]!, s.color[1]!, s.color[2]!);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(String(s.value), x + 10, stripY + 26);
    // label
    doc.setTextColor(120, 135, 155);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text(s.label, x + 10, stripY + 42);
  });

  // ── FILTERS LINE (if any) ─────────────────────────────────────────────────
  let tableStartY = stripY + 50 + 20;
  if (meta.filterLabel) {
    doc.setTextColor(100, 115, 135);
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text(`Filters: ${meta.filterLabel}`, margin, tableStartY - 8);
  }

  // ── TABLE ──────────────────────────────────────────────────────────────────
  const head = [["Date", "Agent", "Emp ID", "Clock In", "Clock Out", "Hours", "Status", "Notes"]];
  const body = rows.map((r) => [
    r.date,
    r.agentName,
    r.employeeId,
    r.clockIn,
    r.clockOut,
    r.hours != null ? `${r.hours.toFixed(2)}h` : "—",
    r.status,
    r.notes || "—",
  ]);

  autoTable(doc, {
    startY: tableStartY,
    head,
    body,
    styles: {
      fontSize: 8,
      cellPadding: 4,
      textColor: [40, 50, 65],
      lineColor: [225, 232, 240],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: [22, 32, 48],
      textColor: [245, 247, 250],
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 100 },
      2: { cellWidth: 50 },
      3: { cellWidth: 55 },
      4: { cellWidth: 55 },
      5: { cellWidth: 45 },
      6: { cellWidth: 55 },
      7: { cellWidth: "auto" },
    },
    didParseCell: (data) => {
      // Color the "Status" column text by status
      if (data.section === "body" && data.column.index === 6) {
        const status = String(data.cell.raw ?? "").toLowerCase().replace(/\s/g, "_");
        const rgb = STATUS_RGB[status];
        if (rgb) {
          data.cell.styles.textColor = rgb;
          data.cell.styles.fontStyle = "bold";
        }
      }
      // Bold the Hours column
      if (data.section === "body" && data.column.index === 5) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor = [76, 213, 184];
      }
    },
    margin: { left: margin, right: margin },
  });

  // ── FOOTER (page numbers) ─────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(225, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(margin, pageH - 24, pageW - margin, pageH - 24);
    doc.setTextColor(150, 165, 185);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Billzo · Confidential · Page ${i} of ${pageCount}`,
      pageW / 2,
      pageH - 12,
      { align: "center" },
    );
  }

  doc.save(`${filename}.pdf`);
}

// ── Stylish attendance Excel export ─────────────────────────────────────────
// Two sheets: "Summary" (stats + filters) and "Records" (the data).

export async function exportAttendanceExcel(
  rows: AttendanceExportRow[],
  filename: string,
  meta: {
    title: string;
    subtitle: string;
    periodLabel: string;
    summary: AttendanceExportSummary;
    filterLabel?: string;
  },
) {
  const XLSX = await import("xlsx");

  // ── Sheet 1: Summary ──────────────────────────────────────────────────────
  const summaryData = [
    [meta.title],
    [meta.subtitle],
    [`Period: ${meta.periodLabel}`],
    meta.filterLabel ? [`Filters: ${meta.filterLabel}`] : [],
    [`Generated: ${new Date().toLocaleString("en-PK")}`],
    [],
    ["Summary"],
    ["Metric", "Value"],
    ["Total Records", meta.summary.totalRecords],
    ["Present", meta.summary.present],
    ["Absent", meta.summary.absent],
    ["Late", meta.summary.late],
    ["Half Day", meta.summary.halfDay],
    ["Leave", meta.summary.leave],
    ["Holiday", meta.summary.holiday],
    ["Total Hours", Number(meta.summary.totalHours.toFixed(2))],
  ].filter((r) => r.length > 0);
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet["!cols"] = [{ wch: 22 }, { wch: 18 }, { wch: 30 }];
  // Merge title row
  summarySheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } },
  ];

  // ── Sheet 2: Records ──────────────────────────────────────────────────────
  const recordsData = rows.map((r) => ({
    Date: r.date,
    Agent: r.agentName,
    "Emp ID": r.employeeId,
    Department: r.department,
    "Clock In": r.clockIn,
    "Clock Out": r.clockOut,
    Hours: r.hours,
    Status: r.status,
    Notes: r.notes,
  }));
  const recordsSheet = XLSX.utils.json_to_sheet(recordsData);
  recordsSheet["!cols"] = [
    { wch: 12 }, // Date
    { wch: 22 }, // Agent
    { wch: 12 }, // Emp ID
    { wch: 18 }, // Department
    { wch: 12 }, // Clock In
    { wch: 12 }, // Clock Out
    { wch: 10 }, // Hours
    { wch: 12 }, // Status
    { wch: 30 }, // Notes
  ];

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, summarySheet, "Summary");
  XLSX.utils.book_append_sheet(book, recordsSheet, "Records");
  const out = XLSX.write(book, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  download(
    new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${filename}.xlsx`,
  );
}
